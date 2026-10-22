import type { Rng } from '../rng';
import type { Vec } from './geometry';
import { rectsOverlap, type Rect } from './pageText';

/** Random places tried for every note box. */
const TRIES = 1000;

/** What a note box must keep clear of: rooms as convex outlines, and rectangles. */
export interface Obstacles {
  polygons: Vec[][];
  rects: Rect[];
}

export interface BoxRequest {
  w: number;
  h: number;
  /** Where the box wants to be near: its room's centre on the page. */
  anchor: Vec;
  /** A place the GM chose: the box's centre. */
  manual?: Vec;
}

/**
 * Places boxes in turn, the GM's first: each takes the free place nearest its anchor among
 * random ones inside `page`, and becomes an obstacle for the next. A box with no free place
 * takes the one where it covers the least, and counts as a clash.
 */
export function placeBoxes(requests: readonly BoxRequest[], page: Rect, obstacles: Obstacles, gap: number, rng: Rng): { boxes: Rect[]; clashes: number } {
  const placed: (Rect | null)[] = requests.map(() => null);
  let clashes = 0;
  const taken = [...obstacles.rects];
  const order = requests.map((_, i) => i).sort((a, b) => Number(!requests[a]!.manual) - Number(!requests[b]!.manual));
  for (const index of order) {
    const req = requests[index]!;
    let box: Rect;
    if (req.manual) {
      box = { x: req.manual.x - req.w / 2, y: req.manual.y - req.h / 2, w: req.w, h: req.h };
    } else {
      const found = bestPlace(req, page, { polygons: obstacles.polygons, rects: taken }, gap, rng);
      box = found.box;
      if (!found.free) clashes++;
    }
    placed[index] = box;
    taken.push(box);
  }
  return { boxes: placed.map(box => box!), clashes };
}

function bestPlace(req: BoxRequest, page: Rect, obstacles: Obstacles, gap: number, rng: Rng): { box: Rect; free: boolean } {
  let best: Rect | null = null;
  let bestScore = Infinity;
  let fallback: Rect | null = null;
  let fallbackScore = Infinity;
  const spanX = Math.max(0, page.w - req.w);
  const spanY = Math.max(0, page.h - req.h);
  for (let i = 0; i < TRIES; i++) {
    const box = { x: page.x + rng() * spanX, y: page.y + rng() * spanY, w: req.w, h: req.h };
    const distance = Math.hypot(box.x + box.w / 2 - req.anchor.x, box.y + box.h / 2 - req.anchor.y);
    const cover = coverage(box, obstacles, gap);
    if (cover === 0 && distance < bestScore) {
      best = box;
      bestScore = distance;
    }
    const score = cover * 1e6 + distance;
    if (score < fallbackScore) {
      fallback = box;
      fallbackScore = score;
    }
  }
  if (best) return { box: best, free: true };
  return { box: fallback ?? { x: page.x, y: page.y, w: req.w, h: req.h }, free: false };
}

/** How many obstacles a box meets. */
function coverage(box: Rect, obstacles: Obstacles, gap: number): number {
  let count = 0;
  for (const r of obstacles.rects) if (rectsOverlap(box, r, gap)) count++;
  const grown = { x: box.x - gap, y: box.y - gap, w: box.w + gap * 2, h: box.h + gap * 2 };
  for (const polygon of obstacles.polygons) if (rectMeetsPolygon(grown, polygon)) count++;
  return count;
}

/** Separating-axis test of a rectangle against a convex polygon. */
export function rectMeetsPolygon(r: Rect, polygon: readonly Vec[]): boolean {
  const corners: Vec[] = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
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
