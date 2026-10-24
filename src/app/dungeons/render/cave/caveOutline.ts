/**
 * A cave's floor as drawn. The outline of its floor cells is walked every quarter cell, smoothed
 * so a staircase of cells becomes a slanting wall and a corner a curve, pushed out and in by the
 * rock's relief (`outlineRelief.ts`) and rounded once more. The drawing is free of the cell grid,
 * held only to agree with it (`outlineGuard.ts`): where a cell would be drawn as the other kind,
 * or the outline would cross itself, the wall near it is eased back towards the cells' own edge,
 * as far as needed. Entrances, crawls and stairwells keep their pinned cell edges straight.
 */

import { traceLoops } from '../../water/contour';
import { type CellGrid, WET } from '../../water/wetGrid';
import { type FloorShape, type Vec, polysOf } from '../geometry';
import { faultless, outlineFaults } from './outlineGuard';
import { outlineRelief, type Relief } from './outlineRelief';

/** A cell edge that stays straight: an entrance's outer mouth. */
export interface PinnedEdge {
  a: Vec;
  b: Vec;
}

/** Corners per cell along the walked outline. */
const STEPS_PER_CELL = 4;
/** How far each way along the outline a corner is averaged with its neighbours, in corners, and how softly. */
const REACH = 8;
const SIGMA = 3.4;
/** How far from a pinned edge the outline takes its full smoothing and relief, in cells. */
const FADE = 1;
/** How many times a misdrawn stretch is eased back, by this much each time, before it keeps to its cells. */
const EASINGS = 8;
const EASE = 0.6;
/** Corners either side of a fault that are eased with it. */
const EASE_REACH = 2;

type IsFloor = (x: number, y: number) => boolean;

/** One traced loop, walked: where its corners lie on the cell edges, and where the free drawing would put them. */
interface Walk {
  base: Vec[];
  pinned: boolean[];
  free: Vec[];
  /** How much of the free drawing each corner keeps: 1 all, 0 the cell edge. */
  keep: Float64Array;
}

function onEdge(p: Vec, edge: PinnedEdge): boolean {
  const { a, b } = edge;
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return Math.abs(cross) < 1e-9 && p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 && p.y >= Math.min(a.y, b.y) - 1e-9 && p.y <= Math.max(a.y, b.y) + 1e-9;
}

/** The loop's corners walked every quarter cell. */
function quarterSteps(loop: readonly Vec[]): Vec[] {
  return loop.flatMap((a, i) => {
    const b = loop[(i + 1) % loop.length]!;
    const steps = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * STEPS_PER_CELL);
    return Array.from({ length: steps }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps }));
  });
}

/** How far each corner lies from the nearest pinned one along the loop, as a share of `FADE` (1 where none is near). */
function fades(pinned: readonly boolean[]): number[] {
  const n = pinned.length;
  const reach = FADE * STEPS_PER_CELL;
  const steps = pinned.map((p) => (p ? 0 : reach));
  for (let round = 0; round < 2; round++) {
    for (let k = 0; k < 2 * n; k++) {
      const i = k % n;
      steps[i] = Math.min(steps[i]!, steps[(i - 1 + n) % n]! + 1);
      const j = n - 1 - i;
      steps[j] = Math.min(steps[j]!, steps[(j + 1) % n]! + 1);
    }
  }
  return steps.map((s) => Math.min(1, s / reach));
}

const WEIGHTS = Array.from({ length: 2 * REACH + 1 }, (_, k) => Math.exp(-((k - REACH) ** 2) / (2 * SIGMA * SIGMA)));
const WEIGHT_SUM = WEIGHTS.reduce((a, b) => a + b, 0);

/** The free drawing of a walked loop: smoothed along the loop, then moved along its normal by the relief. */
function freeDrawing(base: readonly Vec[], fade: readonly number[], relief: Relief): Vec[] {
  const n = base.length;
  const smooth = base.map((b, i) => {
    let x = 0;
    let y = 0;
    for (let k = -REACH; k <= REACH; k++) {
      const p = base[(i + k + n) % n]!;
      const w = WEIGHTS[k + REACH]!;
      x += w * p.x;
      y += w * p.y;
    }
    const f = fade[i]!;
    return { x: b.x + f * (x / WEIGHT_SUM - b.x), y: b.y + f * (y / WEIGHT_SUM - b.y) };
  });
  return smooth.map((s, i) => {
    const before = smooth[(i - 1 + n) % n]!;
    const after = smooth[(i + 1) % n]!;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    // Floor lies on the right of the way round, so the rock lies on the left: (dy, −dx).
    const moved = relief(s.x, s.y, dy / length, -dx / length);
    const f = fade[i]!;
    return { x: s.x + f * (moved.x - s.x), y: s.y + f * (moved.y - s.y) };
  });
}

/** The corners as drawn now: each between its cell edge and its free place, by how much it keeps. */
function placed(walk: Walk): Vec[] {
  return walk.base.map((b, i) => {
    const k = walk.keep[i]!;
    const f = walk.free[i]!;
    return { x: b.x + k * (f.x - b.x), y: b.y + k * (f.y - b.y) };
  });
}

/** One round of Chaikin's corner cutting that keeps pinned corners, and the straight run between two, where they are. */
function cutCorners(points: readonly Vec[], pinned: readonly boolean[]): Vec[] {
  return points.flatMap((p, i) => {
    const j = (i + 1) % points.length;
    const q = points[j]!;
    const near = { x: 0.75 * p.x + 0.25 * q.x, y: 0.75 * p.y + 0.25 * q.y };
    const far = { x: 0.25 * p.x + 0.75 * q.x, y: 0.25 * p.y + 0.75 * q.y };
    if (pinned[i] && pinned[j]) return [p];
    if (pinned[i]) return [p, far];
    if (pinned[j]) return [near];
    return [near, far];
  });
}

/** Which walked corner each corner of the rounded ring came from. */
function roundedOrigins(pinned: readonly boolean[]): number[] {
  return pinned.flatMap((p, i) => {
    const q = pinned[(i + 1) % pinned.length];
    if (p && q) return [i];
    if (p) return [i, i];
    if (q) return [i];
    return [i, i];
  });
}

/** Eases the corners near every fault back towards their cell edges; `all` sends them the whole way. */
function ease(walks: readonly Walk[], rounded: readonly Vec[][], origins: readonly number[][], isFloor: IsFloor, box: CellGrid, all: boolean): boolean {
  const faults = outlineFaults(rounded, isFloor, box);
  if (faultless(faults)) return false;
  // The misdrawn cells and every cell beside them, over the box grown by two cells.
  const x0 = box.x0 - 2;
  const y0 = box.y0 - 2;
  const w = box.w + 4;
  const h = box.h + 4;
  const nearBad = new Uint8Array(w * h);
  for (const c of faults.cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nearBad[(c.y + dy - y0) * w + (c.x + dx - x0)] = 1;
  const isNearBad = (p: Vec): boolean => {
    const gx = Math.floor(p.x) - x0;
    const gy = Math.floor(p.y) - y0;
    return gx >= 0 && gy >= 0 && gx < w && gy < h && nearBad[gy * w + gx] === 1;
  };
  walks.forEach((walk, r) => {
    const marked = new Set<number>();
    for (const segment of faults.crossings[r]!) {
      marked.add(origins[r]![segment]!);
      marked.add(origins[r]![(segment + 1) % origins[r]!.length]!);
    }
    rounded[r]!.forEach((p, k) => {
      if (isNearBad(p)) marked.add(origins[r]![k]!);
    });
    const n = walk.base.length;
    const eased = new Set<number>();
    for (const i of marked) for (let k = -EASE_REACH; k <= EASE_REACH; k++) eased.add((i + k + n) % n);
    for (const j of eased) walk.keep[j] = all ? 0 : walk.keep[j]! * EASE;
  });
  return true;
}

/** The traced, smoothed outline of the cells `isFloor` names in `box`, one poly per piece with its holes. */
export function caveOutline(seed: number, floor: number, isFloor: IsFloor, box: CellGrid, pinned: readonly PinnedEdge[]): FloorShape[] {
  const marks = new Uint8Array(box.w * box.h);
  for (let gy = 0; gy < box.h; gy++) for (let gx = 0; gx < box.w; gx++) if (isFloor(box.x0 + gx, box.y0 + gy)) marks[gy * box.w + gx] = WET;
  // The cells as read once, for the checks every easing makes again.
  const floorAt: IsFloor = (x, y) => {
    const gx = x - box.x0;
    const gy = y - box.y0;
    return gx >= 0 && gy >= 0 && gx < box.w && gy < box.h ? marks[gy * box.w + gx] === WET : isFloor(x, y);
  };
  const relief = outlineRelief(seed, floor);
  const walks: Walk[] = traceLoops(box, marks).map((loop) => {
    const base = quarterSteps(loop);
    const pins = base.map((p) => pinned.some((edge) => onEdge(p, edge)));
    return { base, pinned: pins, free: freeDrawing(base, fades(pins), relief), keep: new Float64Array(base.length).fill(1) };
  });
  const origins = walks.map((walk) => roundedOrigins(walk.pinned));
  const draw = (): Vec[][] => walks.map((walk) => cutCorners(placed(walk), walk.pinned));
  let rounded = draw();
  for (let round = 0; round <= EASINGS; round++) {
    if (!ease(walks, rounded, origins, floorAt, box, round === EASINGS)) return polysOf(rounded);
    rounded = draw();
  }
  // Eased to their cell edges where faults remained: what is left is the cells' own outline.
  return polysOf(faultless(outlineFaults(rounded, floorAt, box)) ? rounded : walks.map((walk) => cutCorners(walk.base, walk.base.map(() => true))));
}
