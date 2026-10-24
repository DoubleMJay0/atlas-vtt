/**
 * Seed, theme, tags and floors in, a whole dungeon out: its theme (one per dungeon), the tags it
 * is built with, every floor's rooms, doors and stairwells planned together, every floor's terrain
 * placed together (holes line up between floors), then each floor's water, undergrowth, furniture
 * and vegetation. Architecture only: no story, no text; a dungeon is named by the GM alone.
 */

import { planFloors, type PlannedFloor } from './floors/planFloors';
import { fiveRoomParams } from './layout/fiveRoom';
import { floraOf } from './growth/flora';
import { placeGrowth } from './growth/placeGrowth';
import { addUndergrowth } from './growth/undergrowth';
import { stairsAndAround } from './floors/stairSpots';
import { DUNGEON_GENERATOR_VERSION, type DungeonFloor, type DungeonModel, type DungeonRequest, requestedFloors } from './model';
import { type DungeonParams, dungeonParams, dungeonTags, floorParams } from './params';
import { floorColumns, placeProps } from './props';
import { roomRoles, type RoomRoles } from './props/roles';
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
  roles: RoomRoles;
  columns: DungeonFloor['columns'];
  /** Where a built theme lets water stand; null where the layout's low points decide. */
  water: ThemeWater | null;
  theme: ThemeId;
}

function finishFloor(seed: number, index: number, parts: FloorParts, terrain: FloorTerrain, level: number): DungeonFloor {
  const { planned, params, roles, columns } = parts;
  const { rooms, doors, stairs } = planned;
  const dry = level <= 0 && params.tags.has('dry');
  const mayPool = (id: number): boolean => parts.water?.pools.has(id) ?? true;
  const pools = dry ? new Set<number>() : poolRooms(floorStream(seed, 'water', index, 'pools'), rooms, doors, params.poolChance, mayPool);
  const kept = [...terrain.takenCells(), ...terrain.propCells(), ...drainCells(terrain.pieces), ...stairsAndAround(stairs), ...(parts.water?.dry ?? [])];
  const { water, waterCells } = placeWater(seed, index, rooms, { level, pools, dry: new Set(kept) });
  const flora = floraOf(params.tags, parts.theme);
  addShallowWater(terrain, waterCells);
  const pieces = addUndergrowth(seed, terrain, waterCells, flora, params.tags.has('ruined'));
  const typedRooms = new Set(rooms.filter((room) => room.type).map((room) => room.id));
  const placed = placeProps({ seed, floor: index, rooms, doors, stairs, columns, terrain: pieces, roles, params, typed: typedRooms, furnished: terrain.propCells() });
  const props = [...terrain.props, ...placed.props];
  const { rubble, cracks } = placed;
  const growth = placeGrowth({ seed, floor: index, rooms, doors, stairs, columns, props, terrain: pieces, waterCells, cracks }, flora);
  return { rooms, doors, columns, props, rubble, cracks, water, waterCells, stairs, terrain: pieces, growth };
}

export function generateDungeon(request: DungeonRequest): DungeonModel {
  const { seed } = request;
  const fiveRoom = request.fiveRoom === true;
  const asked = readTags(request.tags);
  const theme = pickTheme(seed, request.theme ?? 'any', asked);
  const tags = dungeonTags(seed, themedTags(theme, asked));
  const base = dungeonParams(tags);
  const params = fiveRoom ? fiveRoomParams(base) : base;
  const rolled = chooseWaterLevel(seed, request.waterLevel, params.waterLevel);
  const count = requestedFloors(request);
  const planned = planFloors(seed, params, count, fiveRoom || request.bossRoom !== false, fiveRoom);
  const themed = typeDungeon(seed, theme, params.tags, planned);
  const { typed } = themed;
  // A built theme's floors are dry unless the GM or the tags ask for water; then it stands only where its rooms have it.
  const level = typed && request.waterLevel === undefined && params.waterLevel === null ? 0 : rolled;
  const parts = planned.map((floor, index): FloorParts => {
    const floorPar = floorParams(params, index);
    const roles = roomRoles(floorStream(seed, 'props', index, 'roles'), floor);
    return {
      planned: floor,
      params: floorPar,
      roles: typed ? { ...roles, empty: new Set(typed.empty[index]) } : roles,
      columns: floorColumns(seed, index, floor.rooms, floor.stairs, floorPar),
      theme,
      water: typed ? themeWater(floor.rooms, themed.rooms[index] ?? new Map(), params.tags.has('ruined')) : null,
    };
  });
  const terrain = planTerrain(
    seed,
    parts.map(({ planned: floor, roles, columns }, index) => ({ ...floor, columns, roles: roles.roles, empty: roles.empty, types: themed.rooms[index] ?? new Map() })),
    params.tags,
    themed.theme,
  );
  const floors = parts.map((part, index) => finishFloor(seed, index, part, terrain[index] as FloorTerrain, level));
  return { version: DUNGEON_GENERATOR_VERSION, seed, theme, tags, floors };
}
