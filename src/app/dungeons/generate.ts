/**
 * Seed, tags and floors in, a whole dungeon out: the tags it is built with, every floor's rooms,
 * doors and stairwells planned together, then each floor's water and furniture. Architecture
 * only: no story, no text; a dungeon is named by the GM alone.
 */

import { planFloors, type PlannedFloor } from './floors/planFloors';
import { DUNGEON_GENERATOR_VERSION, type DungeonFloor, type DungeonModel, type DungeonRequest, floorCount } from './model';
import { type DungeonParams, dungeonParams, dungeonTags, floorParams } from './params';
import { placeProps } from './props';
import { floorStream } from './rng';
import { chooseWaterLevel, placeWater, poolRooms } from './water';

function finishFloor(seed: number, index: number, planned: PlannedFloor, params: DungeonParams, level: number): DungeonFloor {
  const { rooms, doors, stairs } = planned;
  const dry = level <= 0 && params.tags.has('dry');
  const pools = dry ? new Set<number>() : poolRooms(floorStream(seed, 'water', index, 'pools'), rooms, doors, params.poolChance);
  const { water, waterCells } = placeWater(seed, index, rooms, { level, pools });
  const { columns, props, rubble, cracks } = placeProps({ seed, floor: index, rooms, doors, stairs, params });
  return { rooms, doors, columns, props, rubble, cracks, water, waterCells, stairs };
}

export function generateDungeon(request: DungeonRequest): DungeonModel {
  const { seed } = request;
  const tags = dungeonTags(seed, request.tags);
  const params = dungeonParams(tags);
  const level = chooseWaterLevel(seed, request.waterLevel, params.waterLevel);
  const planned = planFloors(seed, params, floorCount(request.floors));
  const floors = planned.map((floor, index) => finishFloor(seed, index, floor, floorParams(params, index), level));
  return { version: DUNGEON_GENERATOR_VERSION, seed, tags, floors };
}
