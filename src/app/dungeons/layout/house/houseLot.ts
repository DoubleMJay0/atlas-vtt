/**
 * The lot a house stands on and the way to its door (research §5.1, Fabian's decision 3: the garden
 * follows the map's size): a small map leaves a step or two of ground round the house and no wall, a
 * medium one a garden inside a boundary wall or hedge, a large one deep grounds with a drive. The
 * boundary is closed but for the gate before the front door, from which a path (a drive on a large
 * lot, sweeping round a fountain where the front is deep) leads to a porch.
 */

import { cellKey } from '../../geometry';
import type { CellPoint, GroundsPiece } from '../../model';
import { type Rng, chance, int } from '../../rng';
import { type Box, box, boxCells } from './houseGrid';
import type { HouseSize } from './houseParams';

/** Cells of ground round the house on each side, by the map's size (inclusive ranges). */
const MARGINS: Record<HouseSize, { front: [number, number]; side: [number, number]; back: [number, number] }> = {
  small: { front: [1, 2], side: [0, 1], back: [0, 1] },
  medium: { front: [5, 8], side: [2, 4], back: [3, 6] },
  large: { front: [9, 14], side: [4, 7], back: [6, 12] },
};

/** A front this deep or deeper turns the drive round a fountain before the porch. */
const SWEEP_FRONT = 12;

export interface Lot {
  box: Box;
  /** Whether a boundary closes it: a lot with ground enough on every side. */
  walled: boolean;
  pieces: GroundsPiece[];
  /** Cells taken by the boundary, the gate, the way in and the porch, by key. */
  taken: Set<string>;
  /** The cells of the way from the gate to the porch. */
  way: CellPoint[];
}

/**
 * The lot round the house's ground floor (`house`, its bounding box `around`), the front towards +y,
 * the front door's outside cells `door`.
 */
export function houseLot(rng: Rng, size: HouseSize, around: Box, door: readonly CellPoint[]): Lot {
  const m = MARGINS[size];
  const front = int(rng, m.front[0], m.front[1]);
  const side = int(rng, m.side[0], m.side[1]);
  const back = int(rng, m.back[0], m.back[1]);
  const lot = box(around.x - side, around.y - back, around.w + 2 * side, around.h + back + front);
  const walled = size !== 'small';
  const pieces: GroundsPiece[] = [];
  const taken = new Set<string>();
  const take = (cells: readonly CellPoint[]): void => cells.forEach((c) => taken.add(cellKey(c.x, c.y)));
  const drive = size === 'large';
  const width = drive ? 3 : 2;
  const doorX = Math.min(...door.map((c) => c.x));
  const x0 = doorX - Math.floor((width - door.length) / 2);
  const bottom = lot.y + lot.h - 1;
  const gate = Array.from({ length: width }, (_, k) => ({ x: x0 + k, y: bottom }));
  if (walled) {
    const ring = boxCells(lot).filter((c) => c.x === lot.x || c.y === lot.y || c.x === lot.x + lot.w - 1 || c.y === bottom);
    const inGate = (c: CellPoint): boolean => gate.some((g) => g.x === c.x && g.y === c.y);
    pieces.push({ kind: chance(rng, 0.7) ? 'boundary-wall' : 'hedge', cells: ring.filter((c) => !inGate(c)) });
    pieces.push({ kind: 'gate', cells: gate, dir: { x: 0, y: -1 } });
    take(ring);
  }
  const porchRow = door[0]!.y;
  const sweep = drive && front >= SWEEP_FRONT ? sweepAround(x0, width, porchRow + 2) : null;
  const inCentre = (c: CellPoint): boolean => !!sweep?.centre.some((m) => m.x === c.x && m.y === c.y);
  const straight = boxCells(box(x0, porchRow + 1, width, Math.max(0, (walled ? bottom : lot.y + lot.h) - porchRow - 1))).filter((c) => !inCentre(c));
  const way = [...straight, ...(sweep?.ring ?? []).filter((c) => !straight.some((w) => w.x === c.x && w.y === c.y))];
  pieces.push({ kind: drive ? 'drive' : 'path', cells: way });
  if (sweep) pieces.push({ kind: 'garden-fountain', cells: sweep.centre, at: { x: sweep.centre[0]!.x + 1, y: sweep.centre[0]!.y + 1 } });
  // The porch before the front door: its floor and a column at each outer corner.
  const porch = boxCells(box(x0, porchRow, width, 1));
  pieces.push({ kind: 'porch', cells: porch, columns: [{ x: x0 + 0.15, y: porchRow + 0.85 }, { x: x0 + width - 0.15, y: porchRow + 0.85 }] });
  take([...way, ...porch, ...(sweep ? [...sweep.ring, ...sweep.centre] : [])]);
  return { box: lot, walled, pieces, taken, way };
}

/** The ring a drive turns round before the porch: a loop two cells wide round a square of two cells holding a fountain. */
function sweepAround(x0: number, width: number, top: number): { ring: CellPoint[]; centre: CellPoint[] } {
  const cx = x0 + Math.floor(width / 2) - 1;
  const outer = box(cx - 2, top, 6, 6);
  const centre = boxCells(box(cx, top + 2, 2, 2));
  const ring = boxCells(outer).filter((c) => !centre.some((m) => m.x === c.x && m.y === c.y));
  return { ring, centre };
}
