/**
 * Seed and tags in, a whole dungeon out: the tags it is built with, layout and plan, what each
 * room's plan puts in it, then water and props. No text: a dungeon is named by the GM alone.
 */

import { buildDungeonLayout } from './layout/assemble';
import { DUNGEON_GENERATOR_VERSION, type DungeonModel, type DungeonRequest } from './model';
import { dungeonParams, dungeonTags } from './params';
import { placeProps } from './props';
import { roomMarks } from './props/roomMarks';
import { chooseWaterLevel, placeWater } from './water';

export function generateDungeon(request: DungeonRequest): DungeonModel {
  const { seed } = request;
  const tags = dungeonTags(seed, request.tags);
  const params = dungeonParams(tags);
  const { rooms, doors, features } = buildDungeonLayout(seed, params);
  const marks = roomMarks(seed, rooms, features, params.tags);
  const level = chooseWaterLevel(seed, request.waterLevel, params.waterLevel);
  const dry = level <= 0 && params.tags.has('dry');
  const pools = new Set(dry ? [] : [...marks].filter(([, marked]) => marked.water).map(([room]) => room));
  const { water, waterCells } = placeWater(seed, rooms, { level, pools });
  const { columns, props, rubble, cracks } = placeProps({ seed, rooms, doors, marks, features, params });
  return {
    version: DUNGEON_GENERATOR_VERSION,
    seed,
    tags,
    rooms,
    doors,
    columns,
    props,
    rubble,
    cracks,
    water,
    waterCells,
  };
}
