/**
 * The five main rooms of a five-room dungeon as architecture (Johnn Four's stages), never monsters,
 * loot or mechanisms that would ask the GM for a story. Each stage has several ways to be built,
 * chosen by weight and the dungeon's tags, so no two dungeons repeat one another: the entrance a
 * guard post, scattered cover, a dais to hold or an empty hall; the second room a set piece of
 * statues, a basin, an obelisk, pews or tombs; the setback a hazard, rough ground or a ledge; the
 * climax the boss arena; the reward room a point of interest or nothing at all.
 */

import type { CellDir, FiveRoomStage } from '../model';
import { dir } from '../geometry';
import { type Rng, chance, int, pick, weighted } from '../rng';
import type { DungeonTag } from '../tags';
import { furnishArena } from './arena';
import { draft } from './catalog';
import { scatterCover, tryShape } from './cover';
import { pews, roughGround } from './difficult';
import { ledgeAlongWall, platformAtFarWall } from './elevation';
import { hazardWeights, placeHazard } from './hazards';
import { anyInterest, placeInterest } from './interest';
import type { RoomCells } from './roomCells';
import type { TerrainWork } from './work';

function negate(d: CellDir): CellDir {
  return dir(-d.x, -d.y);
}

/** Tries the ways in order of a weighted draw, the drawn one first; false where none fits. */
function firstThatFits<T extends string>(rng: Rng, ways: readonly (readonly [T, number])[], build: (way: T) => boolean): boolean {
  const open = ways.filter(([, w]) => w > 0);
  if (open.length === 0) return false;
  const first = weighted(rng, open);
  return [first, ...open.map(([way]) => way).filter((way) => way !== first)].some(build);
}

/** A low wall across most of the way in, a passage left at one side, defenders behind it. */
function guardPost(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): void {
  const floor = work.floors[k];
  if (!floor) return;
  const longest = Math.max(2, Math.min(4, rc.width - 2));
  const rows = [Math.floor(rc.depth * 0.6), Math.floor(rc.depth * 0.5), rc.depth - 2, Math.floor(rc.depth * 0.4), rc.depth - 1].filter((i, k, all) => i >= 1 && i < rc.depth && all.indexOf(i) === k);
  const left = chance(rng, 0.5);
  const tries = [longest, 3, 2].filter((n, k, all) => n <= longest && all.indexOf(n) === k).flatMap((length) => {
    const sides = [0, rc.width - length, Math.floor((rc.width - length) / 2), 1, rc.width - length - 1].filter((j, k, all) => j >= 0 && j + length <= rc.width && all.indexOf(j) === k);
    return rows.flatMap((i) => (left ? sides : [...sides].reverse()).map((j) => ({ i, j, length })));
  });
  const built = tries.some(({ i, j, length }) => tryShape(floor, rc, { kind: 'low-wall', di: 1, dj: length }, i, j));
  scatterCover(floor, rc, rng, built ? 1 : 2, work.tags);
}

type Entrance = 'guard-post' | 'cover' | 'dais' | 'empty';

/** The way in: held behind a low wall, among scattered cover, from a dais, or an empty hall. */
function entrance(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): void {
  const floor = work.floors[k];
  if (!floor) return;
  const ways: (readonly [Entrance, number])[] = [
    ['guard-post', 3],
    ['cover', 2],
    ['dais', rc.depth >= 6 ? 1.5 : 0],
    ['empty', 1],
  ];
  firstThatFits(rng, ways, (way) => {
    switch (way) {
      case 'guard-post':
        guardPost(work, k, rc, rng);
        return true;
      case 'cover':
        return scatterCover(floor, rc, rng, int(rng, 2, 3), work.tags) > 0;
      case 'dais':
        return platformAtFarWall(floor, rc, 1, Math.ceil(rc.width * 0.5), 1) !== null;
      case 'empty':
        return true;
    }
  });
}

type SetPiece = 'statues' | 'basin' | 'obelisk' | 'pews' | 'tombs' | 'plain';

/** The second room's set piece, something to look at that does nothing by itself. */
function setPiece(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): void {
  const floor = work.floors[k];
  if (!floor) return;
  const room = rc.room.id;
  const { tags } = work;
  const ways: (readonly [SetPiece, number])[] = [
    ['statues', 2],
    ['basin', tags.has('dry') ? 0 : tags.has('wet') || tags.has('flooded') ? 3 : 1.5],
    ['obelisk', 1.5],
    ['pews', tags.has('temple') ? 3 : 0.5],
    ['tombs', tags.has('tomb') ? 3 : 0.5],
    ['plain', 1],
  ];
  firstThatFits(rng, ways, (way) => {
    switch (way) {
      case 'statues': {
        if (!placeInterest(floor, rc, rng, 'mosaic')) return false;
        const i = rc.depth - 2;
        for (const j of [1, Math.floor((rc.width - 1) / 2), rc.width - 2]) floor.place(draft('statue', room, rc.block(i, j, 1, 1), { facing: negate(rc.axis) }));
        return true;
      }
      case 'basin': {
        if (!placeInterest(floor, rc, rng, 'pool')) return false;
        const i = Math.floor((rc.depth - 1) / 2);
        for (const j of [0, rc.width - 1]) floor.place(draft('statue', room, rc.block(i, j, 1, 1), { facing: j === 0 ? rc.across : negate(rc.across) }));
        return true;
      }
      case 'obelisk':
        return placeInterest(floor, rc, rng, 'obelisk');
      case 'pews':
        return pews(floor, rc);
      case 'tombs':
        return [1, rc.width - 2].filter((j) => tryShape(floor, rc, { kind: 'sarcophagus', di: 2, dj: 1 }, Math.max(1, Math.floor(rc.depth / 2) - 1), j)).length > 0;
      case 'plain':
        return anyInterest(floor, rc, rng, tags);
    }
  });
}

type Setback = 'hazard' | 'rubble' | 'broken' | 'ledge';

/** Something in the way: a hazard of the dungeon's kind, rough ground, or a ledge to fight from. */
function setback(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): void {
  const floor = work.floors[k];
  if (!floor) return;
  const { tags } = work;
  const crumbling = tags.has('crumbling');
  const ways: (readonly [Setback, number])[] = [
    ['hazard', 4],
    ['rubble', crumbling ? 3 : 1],
    ['broken', crumbling || tags.has('deep') ? 2 : 0.7],
    ['ledge', tags.has('flat') ? 0 : 1],
  ];
  firstThatFits(rng, ways, (way) => {
    switch (way) {
      case 'hazard':
        return placeHazard(work, k, rc, rng, weighted(rng, hazardWeights(tags).filter(([, w]) => w > 0)));
      case 'rubble':
        return roughGround(floor, rc, rng, 'rubble-field');
      case 'broken':
        return roughGround(floor, rc, rng, 'broken-floor');
      case 'ledge':
        return ledgeAlongWall(floor, rc, rng) !== null;
    }
  });
}

/** The room beyond the boss: a point of interest, or now and then nothing but what the GM puts there. */
function reward(work: TerrainWork, k: number, rc: RoomCells, rng: Rng, tags: ReadonlySet<DungeonTag>): void {
  const floor = work.floors[k];
  if (!floor || chance(rng, 0.2)) return;
  if (!placeInterest(floor, rc, rng, pick(rng, ['altar', 'obelisk', 'mosaic', 'statue'] as const))) anyInterest(floor, rc, rng, tags);
}

/** Terrain for a main room of a five-room dungeon. */
export function furnishStage(work: TerrainWork, k: number, rc: RoomCells, rng: Rng, stage: FiveRoomStage, tags: ReadonlySet<DungeonTag>): void {
  switch (stage) {
    case 'entrance':
      return entrance(work, k, rc, rng);
    case 'puzzle':
      return setPiece(work, k, rc, rng);
    case 'setback':
      return setback(work, k, rc, rng);
    case 'climax':
      return furnishArena(work, k, rc, rng, tags);
    case 'reward':
      return reward(work, k, rc, rng, tags);
  }
}
