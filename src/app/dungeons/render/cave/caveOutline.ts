/**
 * A cave's floor as drawn: the outline of its floor cells, every unit edge split at its middle,
 * each vertex nudged by a hash of where it lies (so the same cells always give the same outline,
 * and a cell changed moves only the outline near it), rounded by Chaikin's corner cutting and held
 * to the cells. Entrances keep their outer mouth straight on its cell edge, where the ground
 * outside is cleared.
 */

import { fnv1a32 } from '../../../utils/hashing';
import { traceLoops } from '../../water/contour';
import { type CellGrid, WET } from '../../water/wetGrid';
import { type FloorShape, type Vec, polysOf } from '../geometry';
import { holdToCells } from './holdToCells';

export { CELL_CORE } from './holdToCells';

/** A cell edge that stays straight: an entrance's outer mouth. */
export interface PinnedEdge {
  a: Vec;
  b: Vec;
}

/** The most a vertex moves each way, in cells. */
export const OUTLINE_JITTER = 0.2;
const CHAIKIN_ROUNDS = 2;

interface Point extends Vec {
  pinned: boolean;
}

function onEdge(p: Vec, edge: PinnedEdge): boolean {
  const { a, b } = edge;
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return Math.abs(cross) < 1e-9 && p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 && p.y >= Math.min(a.y, b.y) - 1e-9 && p.y <= Math.max(a.y, b.y) + 1e-9;
}

/** The loop's corners walked every half cell. */
function halfSteps(loop: readonly Vec[]): Vec[] {
  return loop.flatMap((a, i) => {
    const b = loop[(i + 1) % loop.length]!;
    const steps = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    return Array.from({ length: steps }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps }));
  });
}

/** A vertex moved by a hash of the cave, the floor and its place, within `OUTLINE_JITTER` each way. */
function nudged(seed: number, floor: number, p: Vec, pinned: readonly PinnedEdge[]): Point {
  if (pinned.some((edge) => onEdge(p, edge))) return { ...p, pinned: true };
  const h = fnv1a32(`${seed}:${floor}:${Math.round(p.x * 2)}:${Math.round(p.y * 2)}`);
  const dx = ((h & 0xffff) / 0xffff) * 2 - 1;
  const dy = ((h >>> 16) / 0xffff) * 2 - 1;
  return { x: p.x + dx * OUTLINE_JITTER, y: p.y + dy * OUTLINE_JITTER, pinned: false };
}

/** One round of Chaikin's corner cutting that keeps pinned vertices, and the straight run between two, where they are. */
function cutCorners(points: readonly Point[]): Point[] {
  return points.flatMap((p, i) => {
    const q = points[(i + 1) % points.length]!;
    const near = { x: 0.75 * p.x + 0.25 * q.x, y: 0.75 * p.y + 0.25 * q.y, pinned: false };
    const far = { x: 0.25 * p.x + 0.75 * q.x, y: 0.25 * p.y + 0.75 * q.y, pinned: false };
    if (p.pinned && q.pinned) return [p];
    if (p.pinned) return [p, far];
    if (q.pinned) return [near];
    return [near, far];
  });
}

/** The traced, smoothed outline of the cells `isFloor` names in `box`, one poly per piece with its holes. */
export function caveOutline(seed: number, floor: number, isFloor: (x: number, y: number) => boolean, box: CellGrid, pinned: readonly PinnedEdge[]): FloorShape[] {
  const marks = new Uint8Array(box.w * box.h);
  for (let gy = 0; gy < box.h; gy++) for (let gx = 0; gx < box.w; gx++) if (isFloor(box.x0 + gx, box.y0 + gy)) marks[gy * box.w + gx] = WET;
  const rings = traceLoops(box, marks).map((loop) => {
    let points = halfSteps(loop).map((p) => nudged(seed, floor, p, pinned));
    for (let round = 0; round < CHAIKIN_ROUNDS; round++) points = cutCorners(points);
    return holdToCells(points.map(({ x, y }) => ({ x, y })), isFloor);
  });
  return polysOf(rings);
}
