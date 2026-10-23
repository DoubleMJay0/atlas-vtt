/**
 * What joins floors besides the stairs (Verticality): a gallery over the boss arena, which is then
 * a hall two floors high that the party looks down into from the floor above and may drop into;
 * and shafts, a one-way way down from a room into a room right below it.
 */

import type { CellPoint } from '../model';
import { cellsOf, type CellRect, intersection } from '../geometry';
import { type Rng, chance, int, shuffled } from '../rng';
import { draft } from './catalog';
import { cutHole, dropBelow } from './holes';
import type { RoomCells } from './roomCells';
import type { TerrainWork } from './work';

/** How often the arena is two floors high, where a room lies over it. */
const GALLERY_CHANCE = 0.7;
/** How often a floor has a shaft down to the next. */
const SHAFT_CHANCE = 0.35;

/** A room's floor less the ring of cells along its walls. */
function inner(room: { x: number; y: number; w: number; h: number }): CellRect {
  return { x0: room.x + 1, y0: room.y + 1, x1: room.x + room.w - 2, y1: room.y + room.h - 2 };
}

/** The rectangle and the ones a row or column smaller, largest first. */
function shrinks(r: CellRect): CellRect[] {
  const out = [r, { ...r, x0: r.x0 + 1 }, { ...r, x1: r.x1 - 1 }, { ...r, y0: r.y0 + 1 }, { ...r, y1: r.y1 - 1 }];
  return out.filter((s) => s.x1 - s.x0 >= 1 && s.y1 - s.y0 >= 1);
}

/** A railed hole in a room of the floor above the arena, over the arena's middle. */
export function galleryOverArena(work: TerrainWork, rng: Rng): void {
  const deepest = work.floors.length - 1;
  const arena = work.floors[deepest]?.plan.rooms.find((room) => room.boss);
  const above = work.floors[deepest - 1];
  if (!arena || !above || !chance(rng, GALLERY_CHANCE)) return;
  const candidates = above.plan.rooms
    .filter((room) => room.kind === 'room' && room.wing === 'regular' && !room.rotunda)
    .flatMap((room) => {
      const rc = above.room(room.id);
      const over = intersection(inner(room), inner(arena));
      return rc && over && over.x1 > over.x0 && over.y1 > over.y0 ? [{ rc, over }] : [];
    })
    .sort((a, b) => cellsOf(b.over).length - cellsOf(a.over).length);
  for (const { rc, over } of candidates) {
    for (const rect of shrinks(over)) {
      const cells = cellsOf(rect);
      if (!rc.allows(cells, 'block')) continue;
      above.place({ ...draft('gallery', rc.room.id, cells), opening: { bottom: deepest, link: work.nextLink() } });
      return;
    }
  }
}

/** Free places for a shaft of `size` cells square in the room, a cell clear of its walls. */
function shaftSpots(rc: RoomCells, rng: Rng, size: number): CellPoint[][] {
  if (rc.depth < size + 2 || rc.width < size + 2) return [];
  return Array.from({ length: 6 }, () => rc.block(int(rng, 1, rc.depth - size - 1), int(rng, 1, rc.width - size - 1), size, size));
}

/** Now and then a shaft from a room of floor `k` straight down into a room of the floor below. */
export function shaftDown(work: TerrainWork, k: number, rng: Rng): void {
  const floor = work.floors[k];
  if (!floor || k + 1 >= work.floors.length || !chance(rng, SHAFT_CHANCE)) return;
  const rooms = shuffled(rng, floor.plan.rooms.filter((room) => room.kind === 'room' && room.wing === 'regular' && !room.boss && room.stage === undefined));
  for (const room of rooms) {
    const rc = floor.room(room.id);
    if (!rc) continue;
    for (const cells of shaftSpots(rc, rng, chance(rng, 0.3) ? 2 : 1)) {
      if (!rc.allows(cells, 'block')) continue;
      const drop = dropBelow(work, k, cells, rng, false);
      if (drop?.bottom?.floor === k + 1 && cutHole(work, k, rc, 'shaft', cells, drop) !== null) return;
    }
  }
}
