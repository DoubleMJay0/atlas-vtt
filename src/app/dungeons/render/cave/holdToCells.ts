/**
 * Holds a smoothed cave outline to its cells: every floor cell's inner square stays on the floor's
 * side of it and every rock cell's on the rock's, so the drawn cave never misleads a token about
 * which cells it may stand on.
 */

import type { Vec } from '../geometry';

/** The share of a cell, about its middle each way, that the outline keeps on the cell's side. */
export const CELL_CORE = 0.6;

/** How far outside an inner square the outline is held, so the square's own edge never lies on it. */
const CLEARANCE = 0.01;
const LO = (1 - CELL_CORE) / 2 - CLEARANCE;
const HI = 1 - LO;
/** How many times a segment that still crosses an inner square is split and its middle held. */
const SPLITS = 4;
const EPS = 1e-9;

type IsFloor = (x: number, y: number) => boolean;

/** The point moved out of the inner square it lies in, to the square's nearest side that faces a cell of the other kind. */
function held(p: Vec, isFloor: IsFloor): Vec {
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  const fx = p.x - cx;
  const fy = p.y - cy;
  if (!(fx > LO && fx < HI && fy > LO && fy < HI)) return p;
  const here = isFloor(cx, cy);
  const sides = [
    { d: fx - LO, to: { x: cx + LO, y: p.y }, nx: -1, ny: 0 },
    { d: HI - fx, to: { x: cx + HI, y: p.y }, nx: 1, ny: 0 },
    { d: fy - LO, to: { x: p.x, y: cy + LO }, nx: 0, ny: -1 },
    { d: HI - fy, to: { x: p.x, y: cy + HI }, nx: 0, ny: 1 },
  ];
  const facing = sides.filter((s) => isFloor(cx + s.nx, cy + s.ny) !== here);
  const pool = facing.length ? facing : sides;
  return pool.reduce((best, s) => (s.d < best.d ? s : best)).to;
}

/** Whether the segment passes through the open inner square of cell (cx, cy). */
function crossesCore(a: Vec, b: Vec, cx: number, cy: number): boolean {
  const x0 = cx + LO;
  const y0 = cy + LO;
  const x1 = cx + HI;
  const y1 = cy + HI;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const clips: readonly (readonly [number, number])[] = [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dy, a.y - y0],
    [dy, y1 - a.y],
  ];
  for (const [p, q] of clips) {
    if (p === 0) {
      if (q <= EPS) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
  }
  if (t1 - t0 <= EPS) return false;
  const m = (t0 + t1) / 2;
  const px = a.x + dx * m;
  const py = a.y + dy * m;
  return px > x0 + EPS && px < x1 - EPS && py > y0 + EPS && py < y1 - EPS;
}

/** The first inner square the segment passes through, by its cell, or null. */
function crossedCore(a: Vec, b: Vec): Vec | null {
  for (let cy = Math.floor(Math.min(a.y, b.y)); cy <= Math.floor(Math.max(a.y, b.y)); cy++) {
    for (let cx = Math.floor(Math.min(a.x, b.x)); cx <= Math.floor(Math.max(a.x, b.x)); cx++) if (crossesCore(a, b, cx, cy)) return { x: cx, y: cy };
  }
  return null;
}

/** The way from `a` towards `b` (not including `b`), split where it crosses an inner square until it no longer does. */
function heldWay(a: Vec, b: Vec, isFloor: IsFloor, depth: number): Vec[] {
  const cell = crossedCore(a, b);
  if (!cell) return [a];
  if (depth < SPLITS) {
    const m = held({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, isFloor);
    return [...heldWay(a, m, isFloor, depth + 1), ...heldWay(m, b, isFloor, depth + 1)];
  }
  // A short way that still cuts a corner of the square goes round that corner.
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const corner = { x: cell.x + (mid.x - cell.x < 0.5 ? LO : HI), y: cell.y + (mid.y - cell.y < 0.5 ? LO : HI) };
  return [a, corner];
}

/** The ring with every vertex out of the inner squares and every segment round them. */
export function holdToCells(ring: readonly Vec[], isFloor: IsFloor): Vec[] {
  const points = ring.map((p) => held(p, isFloor));
  return points.flatMap((a, i) => heldWay(a, points[(i + 1) % points.length]!, isFloor, 0));
}
