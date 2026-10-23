import type { Bounds, Vec } from '../geometry';

/** Adds something to the current path; drawing code passes these around instead of shapes. */
export type PathFn = (path: CanvasPath) => void;
/** A value at every point of the map, in cells. */
export type Field = (x: number, y: number) => number;

export function polyPath(points: readonly Vec[]): PathFn {
  return path => {
    if (points.length < 3) return;
    path.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) path.lineTo(points[i]!.x, points[i]!.y);
    path.closePath();
  };
}

export function polysPath(polys: readonly (readonly Vec[])[]): PathFn {
  return path => polys.forEach(poly => polyPath(poly)(path));
}

export function rectPoly(r: { x: number; y: number; w: number; h: number }): Vec[] {
  return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
}

export function grown(b: Bounds, m: number): Bounds {
  return { minX: b.minX - m, minY: b.minY - m, maxX: b.maxX + m, maxY: b.maxY + m };
}

export function centroid(points: readonly Vec[]): Vec {
  const n = points.length || 1;
  return points.reduce((a, p) => ({ x: a.x + p.x / n, y: a.y + p.y / n }), { x: 0, y: 0 });
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Open polylines as one path. */
export function runsPath(runs: readonly (readonly Vec[])[], closed = false): PathFn {
  return path => {
    for (const run of runs) {
      if (run.length < 2) continue;
      path.moveTo(run[0]!.x, run[0]!.y);
      for (let i = 1; i < run.length; i++) path.lineTo(run[i]!.x, run[i]!.y);
      if (closed) path.closePath();
    }
  };
}
