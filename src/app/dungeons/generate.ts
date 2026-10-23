/**
 * Seed, tags and floors in, a whole dungeon out: the tags it is built with, every floor's rooms,
 * doors and stairwells planned together, every floor's terrain placed together (holes line up
 * between floors), then each floor's water and furniture. Architecture only: no story, no text;
 * a dungeon is named by the GM alone.
 */

import { planFloors, type PlannedFloor } from './floors/planFloors';
import { fiveRoomParams } from './layout/fiveRoom';
import { approachCells, spotRect } from './floors/stairSpots';
import { cellKey, cellsOf } from './geometry';
import { DUNGEON_GENERATOR_VERSION, type DungeonFloor, type DungeonModel, type DungeonRequest, type DungeonStair, requestedFloors } from './model';
import { type DungeonParams, dungeonParams, dungeonTags, floorParams } from './params';
import { floorColumns, placeProps } from './props';
import { roomRoles, type RoomRoles } from './props/roles';
import { floorStream } from './rng';
import type { FloorTerrain } from './terrain/floorTerrain';
import { addShallowWater, planTerrain } from './terrain/placeTerrain';
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
  const pieces = addShallowWater(terrain, waterCells);
  const { props, rubble, cracks } = placeProps({ seed, floor: index, rooms, doors, stairs, columns, terrain: pieces, roles, params });
  return { rooms, doors, columns, props, rubble, cracks, water, waterCells, stairs, terrain: pieces };
}

/** Every stairwell, the rows it is reached from at either end and the cells round them, by key: no pool reaches them. */
function stairsAndAround(stairs: readonly DungeonStair[]): string[] {
  const cells = stairs.flatMap((s) => [...cellsOf(spotRect(s)), ...approachCells(s, 'upper'), ...approachCells(s, 'lower')]);
  return cells.flatMap((c) => [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => cellKey(c.x + dx, c.y + dy))));
}

export function generateDungeon(request: DungeonRequest): DungeonModel {
  const { seed } = request;
  const fiveRoom = request.fiveRoom === true;
  const tags = dungeonTags(seed, request.tags);
  const base = dungeonParams(tags);
  const params = fiveRoom ? fiveRoomParams(base) : base;
  const level = chooseWaterLevel(seed, request.waterLevel, params.waterLevel);
  const count = requestedFloors(request);
  const planned = planFloors(seed, params, count, fiveRoom || request.bossRoom !== false, fiveRoom);
  const parts = planned.map((floor, index): FloorParts => {
    const floorPar = floorParams(params, index);
    return {
      planned: floor,
      params: floorPar,
      roles: roomRoles(floorStream(seed, 'props', index, 'roles'), floor),
      columns: floorColumns(seed, index, floor.rooms, floor.stairs, floorPar),
    };
  });
  const terrain = planTerrain(
    seed,
    parts.map(({ planned: floor, roles, columns }) => ({ ...floor, columns, roles: roles.roles, empty: roles.empty })),
    params.tags,
  );
  const floors = parts.map((part, index) => finishFloor(seed, index, part, terrain[index] as FloorTerrain, level));
  return { version: DUNGEON_GENERATOR_VERSION, seed, tags, floors };
}
