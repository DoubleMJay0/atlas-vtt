/**
 * Seed, tags and an optional name in, a whole dungeon out. The order is the seam's
 * (`text/contract.ts`): name and story, layout and plan, notes, then water and props.
 */

import { buildDungeonLayout } from './layout/assemble';
import { DUNGEON_GENERATOR_VERSION, type DungeonModel, type DungeonRequest } from './model';
import { numberNotes } from './numbering';
import { dungeonParams } from './params';
import { roomPlans } from './plan/roomPlans';
import { placeProps } from './props';
import { readTags } from './tags';
import type { DungeonText } from './text/contract';
import { chooseWaterLevel, placeWater } from './water';

export function generateDungeon(request: DungeonRequest, text: DungeonText): DungeonModel {
  const { seed } = request;
  const story = text.nameDungeon(seed, readTags(request.tags), request.name);
  const params = dungeonParams(story.tags);
  const { rooms, doors, features } = buildDungeonLayout(seed, params);
  const noteTexts = text.writeNotes(seed, story, roomPlans(rooms, features));
  const level = chooseWaterLevel(seed, request.waterLevel, params.waterLevel);
  const dry = level <= 0 && params.tags.has('dry');
  const pools = new Set(dry ? [] : noteTexts.filter((note) => note.water).map((note) => note.room));
  const { water, waterCells } = placeWater(seed, rooms, { level, pools });
  const { columns, props, rubble, cracks } = placeProps({ seed, rooms, doors, notes: noteTexts, features, params });
  return {
    version: DUNGEON_GENERATOR_VERSION,
    seed,
    tags: [...story.tags],
    title: story.title,
    story: story.story,
    rooms,
    doors,
    notes: numberNotes(rooms, doors, noteTexts),
    columns,
    props,
    rubble,
    cracks,
    water,
    waterCells,
  };
}
