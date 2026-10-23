import type { Point } from '../types/visionTypes';
import type { Polygon } from './visibility';

/** Largest angle an arc of the circle spans between two corners: as fine as the sweep draws a light's own circle. */
const ARC_STEP = (2 * Math.PI) / 64;

/**
 * The part of `polygon` within `radius` of `centre`, for a polygon star-shaped around `centre`
 * with its corners in the order of their angle (`computeVisibility`'s): its corners inside the
 * circle, the points where its edges cross it, and corners on the circle between them. What a
 * visibility polygon traced to a longer radius holds within a shorter one, without tracing again.
 */
export function clipToDisc(polygon: Polygon, centre: Point, radius: number): Polygon {
  const inside = (p: Point): boolean => Math.hypot(p.x - centre.x, p.y - centre.y) <= radius;
  const start = polygon.findIndex((p) => !inside(p));
  if (start < 0) return polygon.slice();
  const out: Point[] = [];
  let lastExit: number | null = null;
  let firstEntry: number | null = null;
  const angleOf = (p: Point): number => Math.atan2(p.y - centre.y, p.x - centre.x);
  for (let k = 0; k < polygon.length; k++) {
    const a = polygon[(start + k) % polygon.length]!;
    const b = polygon[(start + k + 1) % polygon.length]!;
    const span = withinCircle(a, b, centre, radius);
    if (!span) continue;
    const [t0, t1] = span;
    if (inside(a)) out.push(a);
    else {
      const entry = along(a, b, t0);
      if (lastExit === null) firstEntry = angleOf(entry);
      else arc(out, centre, radius, lastExit, angleOf(entry));
      out.push(entry);
    }
    if (t1 < 1) {
      const exit = along(a, b, t1);
      out.push(exit);
      lastExit = angleOf(exit);
    }
  }
  if (firstEntry === null || lastExit === null) {
    // No edge comes within the circle, and the polygon holds its centre: the whole circle.
    const steps = Math.round((2 * Math.PI) / ARC_STEP);
    return Array.from({ length: steps }, (_, i) => onCircle(centre, radius, -Math.PI + (2 * Math.PI * i) / steps));
  }
  arc(out, centre, radius, lastExit, firstEntry);
  return out;
}

/** The share of the edge from `a` to `b` within the circle, as two parameters along it, or null where it misses the circle. */
function withinCircle(a: Point, b: Point, centre: Point, radius: number): [number, number] | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fx = a.x - centre.x, fy = a.y - centre.y;
  const aa = dx * dx + dy * dy;
  const c = fx * fx + fy * fy - radius * radius;
  if (aa < 1e-12) return c <= 0 ? [0, 1] : null;
  const half = (fx * dx + fy * dy) / aa;
  const disc = half * half - c / aa;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t0 = Math.max(0, -half - root), t1 = Math.min(1, -half + root);
  return t0 <= t1 ? [t0, t1] : null;
}

function along(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Corners on the circle strictly between the angles `from` and `to`, turning the way the polygon's corners do. */
function arc(out: Point[], centre: Point, radius: number, from: number, to: number): void {
  let turn = to - from;
  while (turn < 0) turn += 2 * Math.PI;
  while (turn > 2 * Math.PI) turn -= 2 * Math.PI;
  const steps = Math.ceil(turn / ARC_STEP);
  for (let i = 1; i < steps; i++) out.push(onCircle(centre, radius, from + (turn * i) / steps));
}

function onCircle(centre: Point, radius: number, angle: number): Point {
  return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
}
