/**
 * Seed, theme, tags and floors in, a whole dungeon out: its theme (one per dungeon), the tags it
 * is built with, every floor's rooms, doors and stairwells planned together, every floor's terrain
 * placed together (holes line up between floors), then each floor's water, undergrowth, furniture
 * and vegetation. Architecture only: no story, no text; a dungeon is named by the GM alone.
 */

import { planFloors, type PlannedFloor } from './floors/planFloors';
import { caveParams } from './layout/cavern/caveParams';
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
import { type DungeonTag, readTags } from './tags';
import { assignRoomTypes, type RoomTypes } from './themes/assign/assignRoomTypes';
import type { FloorTerrain } from './terrain/floorTerrain';
import { addShallowWater, planTerrain } from './terrain/placeTerrain';
import { NO_FACTS, pickTheme, programmeOf, themedTags, themeOf } from './themes/themes';
import type { ThemeId } from './themes/themeTypes';
import { chooseWaterLevel, placeWater, poolRooms } from './water';

interface FloorParts {
  planned: PlannedFloor;
  params: DungeonParams;
  roles: RoomRoles;
  columns: DungeonFloor['columns'];
}

function finishFloor(seed: number, index: number, parts: FloorParts, terrain: FloorTerrain, level: number): DungeonFloor {
  const { planned, params, roles, columns } = parts;
  const { rooms, doors, stairs } = planned;
  const dry = level <= 0 && params.tags.has('dry');
  const pools = dry ? new Set<number>() : poolRooms(floorStream(seed, 'water', index, 'pools'), rooms, doors, params.poolChance);
  const { water, waterCells } = placeWater(seed, index, rooms, { level, pools, dry: new Set([...terrain.takenCells(), ...stairsAndAround(stairs)]) });
  const flora = floraOf(params.tags);
  addShallowWater(terrain, waterCells);
  const pieces = addUndergrowth(seed, terrain, waterCells, flora);
  const { props, rubble, cracks } = placeProps({ seed, floor: index, rooms, doors, stairs, columns, terrain: pieces, roles, params });
  const growth = placeGrowth({ seed, floor: index, rooms, doors, stairs, columns, props, terrain: pieces, waterCells, cracks }, flora);
  return { rooms, doors, columns, props, rubble, cracks, water, waterCells, stairs, terrain: pieces, growth };
}

/**
 * Types every normal room of a theme with a room programme (`DungeonRoom.type`) and returns the
 * assignment; null for a theme that furnishes by roles.
 */
function typeRooms(seed: number, theme: ThemeId, tags: ReadonlySet<DungeonTag>, floors: readonly PlannedFloor[]): RoomTypes | null {
  const definition = themeOf(theme);
  const programme = programmeOf(definition, tags);
  if (!programme) return null;
  const facts = definition.facts?.({ seed, tags, floors }) ?? NO_FACTS;
  const typed = assignRoomTypes({ seed, programme, floors, ruined: tags.has('ruined'), facts });
  floors.forEach((floor, index) => {
    for (const room of floor.rooms) {
      const type = typed.byFloor[index]?.get(room.id);
      if (type) room.type = type;
    }
  });
  return typed;
}

export function generateDungeon(request: DungeonRequest): DungeonModel {
  const { seed } = request;
  const fiveRoom = request.fiveRoom === true;
  const asked = readTags(request.tags);
  const theme = pickTheme(seed, request.theme ?? 'any', asked);
  const tags = dungeonTags(seed, themedTags(theme, asked));
  const base = theme === 'cavern' ? caveParams(dungeonParams(tags)) : dungeonParams(tags);
  const params = fiveRoom ? fiveRoomParams(base) : base;
  const level = chooseWaterLevel(seed, request.waterLevel, params.waterLevel);
  const count = requestedFloors(request);
  const planned = planFloors(seed, params, count, fiveRoom || request.bossRoom !== false, fiveRoom);
  const typed = typeRooms(seed, theme, params.tags, planned);
  const parts = planned.map((floor, index): FloorParts => {
    const floorPar = floorParams(params, index);
    const roles = roomRoles(floorStream(seed, 'props', index, 'roles'), floor);
    return {
      planned: floor,
      params: floorPar,
      roles: typed ? { ...roles, empty: new Set(typed.empty[index]) } : roles,
      columns: floorColumns(seed, index, floor.rooms, floor.stairs, floorPar),
    };
  });
  const terrain = planTerrain(
    seed,
    parts.map(({ planned: floor, roles, columns }) => ({ ...floor, columns, roles: roles.roles, empty: roles.empty })),
    params.tags,
  );
  const floors = parts.map((part, index) => finishFloor(seed, index, part, terrain[index] as FloorTerrain, level));
  return { version: DUNGEON_GENERATOR_VERSION, seed, theme, tags, floors };
}
