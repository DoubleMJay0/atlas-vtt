/**
 * Holes through floors (Verticality): a chasm, a shaft or a gallery on floor `k` opens onto the
 * floors below. A hole only lies over the floor of a regular room on the floor below, never over
 * rock, a wall, a stairwell or the cells before a door: there it either opens on (an abyss through
 * several floors, never cutting that room in two) or ends, and its fall ends on loose rubble
 * (`chasm-floor`, difficult). Below the deepest floor there is nothing: a bottomless void.
 */

import type { CellPoint, TerrainKind } from '../model';
import { type Rng, chance } from '../rng';
import { draft } from './catalog';
import type { RoomCells } from './roomCells';
import type { TerrainWork } from './work';

/** How likely an abyss opens on through the floor below where it could. */
const OPEN_ON = 0.6;

/** Where a hole over `cells` on floor `k` leads: the floors it opens through below, and the floor it ends on (null: bottomless). */
export interface Drop {
  through: { floor: number; rc: RoomCells }[];
  bottom: { floor: number; rc: RoomCells } | null;
}

/** The way down from a hole over `cells` on floor `k`; null where no floor below can take it. */
export function dropBelow(work: TerrainWork, k: number, cells: readonly CellPoint[], rng: Rng, mayOpenOn = true): Drop | null {
  const through: Drop['through'] = [];
  for (let floor = k + 1; floor < work.floors.length; floor++) {
    const rc = work.floors[floor]?.roomHolding(cells);
    if (!rc || rc.room.wing !== 'regular') return null;
    const last = floor === work.floors.length - 1;
    const canOpen = mayOpenOn && rc.allows(cells, 'block');
    const canEnd = rc.fits(cells);
    if (canOpen && (!canEnd || chance(rng, OPEN_ON))) {
      through.push({ floor, rc });
      if (last) return { through, bottom: null };
      continue;
    }
    return canEnd ? { through, bottom: { floor, rc } } : null;
  }
  return { through, bottom: null };
}

const FLOOR_UNDER: Readonly<Partial<Record<TerrainKind, string>>> = { shaft: 'dungeon.terrain.shaftFloor' };

/**
 * Cuts a hole of `kind` over `cells` in room `rc` of floor `k`, `bridges` laid over it, and the
 * holes and the rubble below it as `drop` found them. The hole's id, or null where its own room
 * cannot take it.
 */
export function cutHole(work: TerrainWork, k: number, rc: RoomCells, kind: TerrainKind, cells: CellPoint[], drop: Drop, options: { bridge?: CellPoint[]; name?: string } = {}): number | null {
  const link = work.nextLink();
  const opening = { bottom: drop.bottom?.floor ?? null, link };
  const floor = work.floors[k];
  if (!floor) return null;
  const id = floor.place({ ...draft(kind, rc.room.id, cells, { name: options.name }), opening }, options.bridge);
  if (id === null) return null;
  for (const { floor: below, rc: room } of drop.through) {
    work.floors[below]?.addHeld({ ...draft('chasm', room.room.id, cells.map((c) => ({ ...c }))), opening });
  }
  if (drop.bottom) {
    const { floor: below, rc: room } = drop.bottom;
    work.floors[below]?.addHeld({ ...draft('chasm-floor', room.room.id, cells.map((c) => ({ ...c })), { name: FLOOR_UNDER[kind] }), under: link });
  }
  return id;
}
