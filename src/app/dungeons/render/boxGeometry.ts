/** Distances and overlaps between note boxes and room outlines, in page pixels. */

import { pointSegmentDistance, pointsBounds, type Vec } from './geometry';
import type { Rect } from './pageText';

/** The gap between a rectangle and a polygon's bounding box; 0 where they overlap. */
export function rectBoundsGap(r: Rect, polygon: readonly Vec[]): number {
  const { minX, minY, maxX, maxY } = pointsBounds(polygon);
  const dx = Math.max(0, minX - (r.x + r.w), r.x - maxX);
  const dy = Math.max(0, minY - (r.y + r.h), r.y - maxY);
  return Math.hypot(dx, dy);
}

/** The gap between a rectangle and a polygon's outline (0 where they meet). */
export function rectPolygonGap(r: Rect, polygon: readonly Vec[]): number {
  if (rectMeetsPolygon(r, polygon)) return 0;
  const corners = rectCorners(r);
  let best = Infinity;
  for (const p of polygon) {
    const dx = Math.max(0, r.x - p.x, p.x - (r.x + r.w));
    const dy = Math.max(0, r.y - p.y, p.y - (r.y + r.h));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    for (const c of corners) best = Math.min(best, pointSegmentDistance(c, a, b));
  }
  return best;
}

/** Separating-axis test of a rectangle against a convex polygon. */
export function rectMeetsPolygon(r: Rect, polygon: readonly Vec[]): boolean {
  const corners = rectCorners(r);
  const axes: Vec[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    axes.push({ x: -(b.y - a.y), y: b.x - a.x });
  }
  for (const axis of axes) {
    const [minA, maxA] = project(corners, axis);
    const [minB, maxB] = project(polygon, axis);
    if (maxA < minB || maxB < minA) return false;
  }
  return true;
}

function project(points: readonly Vec[], axis: Vec): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const d = p.x * axis.x + p.y * axis.y;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return [min, max];
}

/** Whether the segment from `a` to `b` meets a convex polygon. */
export function segmentMeetsPolygon(a: Vec, b: Vec, polygon: readonly Vec[]): boolean {
  const axes: Vec[] = [{ x: -(b.y - a.y), y: b.x - a.x }, { x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!;
    const q = polygon[(i + 1) % polygon.length]!;
    axes.push({ x: -(q.y - p.y), y: q.x - p.x });
  }
  for (const axis of axes) {
    const [minA, maxA] = project([a, b], axis);
    const [minB, maxB] = project(polygon, axis);
    if (maxA < minB || maxB < minA) return false;
  }
  return true;
}

export function rectCorners(r: Rect): Vec[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}
