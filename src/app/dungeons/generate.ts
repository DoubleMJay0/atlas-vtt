/**
 * Seed, theme, tags and floors in, a whole dungeon out: its theme (one per dungeon), the tags it
 * is built with, every floor's rooms, doors and stairwells planned together, every floor's terrain
 * placed together (holes line up between floors), then each floor's water, undergrowth, furniture
 * and vegetation. Architecture only: no story, no text; a dungeon is named by the GM alone.
 */

import { planFloors, type PlannedFloor } from './floors/planFloors';
import { caveParams } from './layout/cavern/caveParams';
import { type CaveSites, caveSites } from './layout/cavern/caveSites';
import { caveLife } from './themes/cavern/caveLife';
import { shapeCaves } from './layout/cavern/shapeCave';
import { fiveRoomParams } from './layout/fiveRoom';
import { floraOf } from './growth/flora';
import { placeGrowth } from './growth/placeGrowth';
import { addUndergrowth } from './growth/undergrowth';
import { stairsAndAround } from './floors/stairSpots';
import { type CaveFloor, DUNGEON_GENERATOR_VERSION, type DungeonFloor, type DungeonModel, type DungeonRequest, type DungeonRoom, type DungeonTerrain, requestedFloors } from './model';
import { type DungeonParams, dungeonParams, dungeonTags, floorParams } from './params';
import { floorColumns, placeScatter } from './props';
import { floorStream } from './rng';
import { readTags } from './tags';
import type { FloorTerrain } from './terrain/floorTerrain';
import { addShallowWater, planTerrain } from './terrain/placeTerrain';
import { pickTheme, themedTags } from './themes/themes';
import type { ThemeId } from './themes/themeTypes';
import { typeDungeon } from './themes/typeDungeon';
import { themeWater, type ThemeWater } from './themes/themeWater';
import { chooseWaterLevel, drainCells, placeWater, poolRooms } from './water';

interface FloorParts {
  planned: PlannedFloor;
  params: DungeonParams;
  /** Normal rooms left without furniture. */
  empty: ReadonlySet<number>;
  columns: DungeonFloor['columns'];
  /** Where a built theme lets water stand; null where the layout's low points decide. */
  water: ThemeWater | null;
  theme: ThemeId;
}

/** The least water level of a lived-in cave the GM gave none. */
const LIVED_IN_WATER = 0.1;

/** The share of a cave's water level the floor nearest the surface keeps; the deepest keeps it whole. */
const CAVE_UPPER_WATER = 0.3;

/**
 * Where a cave's water lies: standing in its basins (and behind the dam of a lake at its end),
 * running through its stream rooms, never where lava or acid runs.
 */
function caveWater(cave: CaveFloor, rooms: readonly DungeonRoom[], pieces: readonly DungeonTerrain[]): { pools: Set<number>; rooms: Set<number> } {
  const molten = new Set(pieces.filter((p) => p.traits.hazard === 'lava' || p.traits.hazard === 'acid').map((p) => p.room));
  const dry = (id: number): boolean => !molten.has(id);
  const pools = [...cave.basins, ...cave.dams.filter((id) => rooms[id]?.type === 'lake-cavern')].filter(dry);
  return { pools: new Set(pools), rooms: new Set([...pools, ...cave.streams.flat().filter(dry)]) };
}

function finishFloor(seed: number, index: number, parts: FloorParts, terrain: FloorTerrain, level: number, site: CaveSites | undefined): DungeonFloor {
  const { planned, params, columns } = parts;
  const { rooms, doors, stairs, cave } = planned;
  const dry = level <= 0 && params.tags.has('dry');
  const mayPool = (id: number): boolean => parts.water?.pools.has(id) ?? true;
  const wet = cave && caveWater(cave, rooms, terrain.pieces);
  const pools = dry ? new Set<number>() : (wet?.pools ?? poolRooms(floorStream(seed, 'water', index, 'pools'), rooms, doors, params.poolChance, mayPool));
  const kept = [...terrain.takenCells(), ...terrain.propCells(), ...drainCells(terrain.pieces), ...stairsAndAround(stairs), ...(parts.water?.dry ?? [])];
  const { water, waterCells } = placeWater(seed, index, rooms, { level, pools, dry: new Set(kept), ...(wet && { rooms: wet.rooms }) });
  const flora = floraOf(params.tags, parts.theme);
  addShallowWater(terrain, waterCells);
  // A built theme (one whose water its rooms decide) keeps its typed rooms clear of thickets, unless it lies in ruins.
  // A cave's life keeps to its zones: daylight by the mouth, fungi by water and roosts, nothing where lava runs.
  const life = site && caveLife(site, { rooms, doors, terrain: terrain.pieces });
  const pieces = addUndergrowth(seed, terrain, waterCells, flora, parts.water !== null && !params.tags.has('ruined'), life);
  const { props } = terrain;
  const { rubble, cracks } = placeScatter({ seed, floor: index, rooms, doors, stairs, columns, terrain: pieces, params, furnished: terrain.propCells() });
  const grown = placeGrowth({ seed, floor: index, rooms, doors, stairs, columns, props, terrain: pieces, waterCells, cracks }, flora);
  const growth = life ? grown.filter((g) => life(g.room, g.kind)) : grown;
  return { rooms, doors, columns, props, rubble, cracks, water, waterCells, stairs, terrain: pieces, growth, ...(cave && { cave }) };
}

export function generateDungeon(request: DungeonRequest): DungeonModel {
  const { seed } = request;
  const fiveRoom = request.fiveRoom === true;
  const asked = readTags(request.tags);
  const theme = pickTheme(seed, request.theme ?? 'any', asked);
  const tags = dungeonTags(seed, themedTags(theme, asked));
  const base = theme === 'cavern' ? caveParams(dungeonParams(tags)) : dungeonParams(tags);
  const params = fiveRoom ? fiveRoomParams(base) : base;
  const chosen = chooseWaterLevel(seed, request.waterLevel, params.waterLevel);
  // A lived-in cave has water to live by, unless the GM asked for none.
  const rolled = params.cave && params.tags.has('inhabited') && request.waterLevel === undefined ? Math.max(chosen, LIVED_IN_WATER) : chosen;
  const count = requestedFloors(request);
  const boss = fiveRoom || request.bossRoom !== false;
  const laid = planFloors(seed, params, count, boss, fiveRoom);
  // A Cavern shapes its rooms into chambers and tunnels before anything reads them.
  const shaped = params.cave ? shapeCaves(seed, params, laid, boss, rolled) : null;
  const planned = shaped?.floors ?? laid;
  const sites = shaped ? caveSites(planned) : null;
  const themed = typeDungeon(seed, theme, params.tags, planned);
  const { typed } = themed;
  // A built theme's floors are dry unless the GM or the tags ask for water; then it stands only where its rooms have it.
  const { built } = themed.theme.definition;
  const level = built && request.waterLevel === undefined && params.waterLevel === null ? 0 : rolled;
  const parts = planned.map((floor, index): FloorParts => {
    const floorPar = floorParams(params, index);
    return {
      planned: floor,
      params: floorPar,
      empty: new Set(typed.empty[index]),
      columns: floorColumns(seed, index, floor.rooms, floor.stairs, floorPar),
      theme,
      water: built ? themeWater(floor.rooms, themed.rooms[index] ?? new Map(), params.tags.has('ruined')) : null,
    };
  });
  const terrain = planTerrain(
    seed,
    parts.map(({ planned: floor, empty, columns }, index) => ({ ...floor, columns, empty, types: themed.rooms[index] ?? new Map() })),
    params.tags,
    themed.theme,
    shaped && sites ? { sites, variant: shaped.cave.variant } : undefined,
  );
  // A cave's water drains down: each floor above the deepest stands lower.
  const levelOf = (index: number): number => (shaped ? level * (CAVE_UPPER_WATER + ((1 - CAVE_UPPER_WATER) * (index + 1)) / parts.length) : level);
  const floors = parts.map((part, index) => finishFloor(seed, index, part, terrain[index] as FloorTerrain, levelOf(index), sites?.[index]));
  return { version: DUNGEON_GENERATOR_VERSION, seed, theme, tags, floors, ...(shaped && { cave: shaped.cave }) };
}
