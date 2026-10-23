/**
 * The five main rooms of a five-room dungeon as architecture (Johnn Four's stages), never monsters
 * or loot: the entrance holds a guard post (a low wall across the way in, defended from the far
 * side, and crates); the puzzle room is built round an interactive set piece; the setback room
 * has a hazard across the way; the climax is the boss arena; the reward room beyond it holds a
 * point of interest.
 */

import type { CellDir, FiveRoomStage } from '../model';
import { dir } from '../geometry';
import { type Rng, chance, pick, weighted } from '../rng';
import type { DungeonTag } from '../tags';
import { furnishArena } from './arena';
import { draft } from './catalog';
import { scatterCover, tryShape } from './cover';
import { placeHazard } from './hazards';
import { anyInterest, placeInterest } from './interest';
import type { RoomCells } from './roomCells';
import type { TerrainWork } from './work';

function negate(d: CellDir): CellDir {
  return dir(-d.x, -d.y);
}

/** A low wall across most of the way in, a passage left at one side, defenders behind it. */
function guardPost(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): void {
  const floor = work.floors[k];
  if (!floor) return;
  const length = Math.max(2, Math.min(4, rc.width - 2));
  const rows = [Math.floor(rc.depth * 0.6), Math.floor(rc.depth * 0.5), rc.depth - 2].filter((i) => i >= 1 && i < rc.depth);
  const sides = chance(rng, 0.5) ? [0, rc.width - length] : [rc.width - length, 0];
  const built = rows.some((i) => sides.some((j) => tryShape(floor, rc, { kind: 'low-wall', di: 1, dj: length }, i, j)));
  scatterCover(floor, rc, rng, built ? 1 : 2, work.tags);
}

/** The puzzle room's set piece: statues watching a mosaic, a mechanism of levers round an obelisk, or a basin between two statues. */
function puzzle(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): void {
  const floor = work.floors[k];
  if (!floor) return;
  const room = rc.room.id;
  const choice = weighted(rng, [
    ['statues', 3],
    ['mechanism', 2],
    ['basin', work.tags.has('dry') ? 0 : 2],
  ] as const);
  if (choice === 'statues') {
    placeInterest(floor, rc, rng, 'mosaic');
    const i = rc.depth - 2;
    for (const j of [1, Math.floor((rc.width - 1) / 2), rc.width - 2]) floor.place(draft('statue', room, rc.block(i, j, 1, 1), { facing: negate(rc.axis) }));
  } else if (choice === 'mechanism') {
    placeInterest(floor, rc, rng, 'obelisk');
    for (let n = 0; n < 3; n++) placeInterest(floor, rc, rng, 'lever');
  } else {
    placeInterest(floor, rc, rng, 'pool');
    const i = Math.floor((rc.depth - 1) / 2);
    for (const j of [0, rc.width - 1]) floor.place(draft('statue', room, rc.block(i, j, 1, 1), { facing: j === 0 ? rc.across : negate(rc.across) }));
  }
  if (floor.inRoom(room).length === 0) anyInterest(floor, rc, rng, work.tags);
}

/** Terrain for a main room of a five-room dungeon. */
export function furnishStage(work: TerrainWork, k: number, rc: RoomCells, rng: Rng, stage: FiveRoomStage, tags: ReadonlySet<DungeonTag>): void {
  switch (stage) {
    case 'entrance':
      return guardPost(work, k, rc, rng);
    case 'puzzle':
      return puzzle(work, k, rc, rng);
    case 'setback':
      placeHazard(work, k, rc, rng, pick(rng, ['chasm', 'chasm', 'channel', 'deep-water', 'pit'] as const));
      return;
    case 'climax':
      return furnishArena(work, k, rc, rng, tags);
    case 'reward': {
      const floor = work.floors[k];
      if (floor && !placeInterest(floor, rc, rng, pick(rng, ['altar', 'obelisk', 'mosaic', 'statue'] as const))) anyInterest(floor, rc, rng, tags);
      return;
    }
  }
}
