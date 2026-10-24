/**
 * The first room of a floor further from the entrance: a room around the stairs' end from the
 * floor before, the stairwell against one of its walls and its arrival row on the floor (past the
 * low end where the floor lies below, before the high end where it lies above). Its size is drawn, and of
 * every place it may stand one is picked.
 */

import type { CellDir, CellPoint } from '../model';
import { type CellRect, cellKey, cellsOf } from '../geometry';
import { MAX_SEED, type Rng, int, pick, shuffled } from '../rng';
import type { FloorRoot } from '../layout/grow';
import { drawRoomSize } from '../layout/sizes';
import { STAIR_DIRS, type StairEnd, type StairSpot, approachCells, spotFits, spotRect } from './stairSpots';

/** Sizes tried before an attempt gives up on its landing. */
const SIZE_TRIES = 4;

/** The floor rectangle of a room of this size whose near wall faces against `axis`, its near corner at (x0, y0). */
function floorDims(axis: CellDir, width: number, depth: number): { w: number; h: number } {
  return axis.x !== 0 ? { w: depth - 2, h: width - 2 } : { w: width - 2, h: depth - 2 };
}

/** The door cell in the middle of the near wall of a room with floor `f` growing along `axis`. */
function originOf(f: CellRect, axis: CellDir): CellPoint {
  const cx = (f.x0 + f.x1) / 2;
  const cy = (f.y0 + f.y1) / 2;
  if (axis.y > 0) return { x: cx, y: f.y0 - 1 };
  if (axis.y < 0) return { x: cx, y: f.y1 + 1 };
  if (axis.x > 0) return { x: f.x0 - 1, y: cy };
  return { x: f.x1 + 1, y: cy };
}

/** The floor rectangles of size `w` × `h` that hold the stairwell and its arrival row, against one wall. */
function placements(spot: StairSpot, end: StairEnd, w: number, h: number): CellRect[] {
  const need = [...cellsOf(spotRect(spot)), ...approachCells(spot, end)];
  const xs = need.map((c) => c.x);
  const ys = need.map((c) => c.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const out: CellRect[] = [];
  for (let x0 = maxX - w + 1; x0 <= minX; x0++) {
    for (let y0 = maxY - h + 1; y0 <= minY; y0++) out.push({ x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 });
  }
  return out;
}

/** How many cells of `f` lie over `below`. */
function overlap(f: CellRect, below: CellRect): number {
  const w = Math.min(f.x1, below.x1) - Math.max(f.x0, below.x0) + 1;
  const h = Math.min(f.y1, below.y1) - Math.max(f.y0, below.y0) + 1;
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The landing's first room for an attempt, or null where no room drawn fits it. Over `below` (the
 * floor of the room the stairs rise from, for a storey) it stands where it covers most of that
 * room, as an upper room of a tower stands over the room below it.
 */
export function landingRoot(rng: Rng, spot: StairSpot, end: StairEnd, below: CellRect | null = null): FloorRoot | null {
  for (let tries = 0; tries < SIZE_TRIES; tries++) {
    const size = drawRoomSize(rng);
    const options = shuffled(rng, STAIR_DIRS).flatMap((axis) => {
      const { w, h } = floorDims(axis, size.width, size.depth);
      return placements(spot, end, w, h).map((f) => ({ f, axis }));
    });
    const fitting = options.filter(({ f }) => {
      const room = { id: 0, x: f.x0, y: f.y0, w: f.x1 - f.x0 + 1, h: f.y1 - f.y0 + 1, kind: 'room' as const, rotunda: false };
      return spotFits(room, { doors: [], stairs: [], ends: [] }, spot, end);
    });
    if (fitting.length === 0) continue;
    const most = below ? Math.max(...fitting.map(({ f }) => overlap(f, below))) : 0;
    const { f, axis } = pick(rng, below ? fitting.filter(({ f }) => overlap(f, below) === most) : fitting);
    return { origin: originOf(f, axis), axis, seed: int(rng, 1, MAX_SEED), landing: size };
  }
  return null;
}

/** The cells no door of the landing's floor may open onto: the stairwell and its arrival row. */
export function landingCells(spot: StairSpot, end: StairEnd): Set<string> {
  return new Set([...cellsOf(spotRect(spot)), ...approachCells(spot, end)].map((c) => cellKey(c.x, c.y)));
}
