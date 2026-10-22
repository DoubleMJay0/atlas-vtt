import type { Rng } from '../rng';
import { rectBoundsGap, rectCorners, rectMeetsPolygon, rectPolygonGap, segmentMeetsPolygon } from './boxGeometry';
import type { Vec } from './geometry';
import { rectsOverlap, type Rect } from './pageText';

/** Random places tried for every note box. */
const TRIES = 1000;
/** Free places each box keeps to choose from, best first. */
const CANDIDATES = 48;
/** What a box beside another room costs, in gaps between boxes. */
const MISREAD_GAPS = 25;
/** Rounds of moving boxes to better places, or two boxes at once. */
const ROUNDS = 6;

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
  /** Its room's outline among the obstacles' polygons: the box keeps close to it, and closer than to any other. */
  room?: number;
  /** A place the GM chose: the box's centre. */
  manual?: Vec;
  /** The box points at its room with a tail, which had best cross no other room. */
  tail?: boolean;
}

interface Candidate {
  box: Rect;
  score: number;
}

/**
 * Places the boxes: the GM's where the GM put them, every other box at a free place near its
 * room. Each box gathers its best free places among random ones inside `page`; the boxes take
 * them in turn, those with the nearest places first, and then trade places, alone or two at a
 * time, while that brings the boxes as a whole nearer their rooms. A box with no free place
 * left takes the one where it covers the least, and counts as a clash.
 */
export function placeBoxes(requests: readonly BoxRequest[], page: Rect, obstacles: Obstacles, gap: number, rng: Rng): { boxes: Rect[]; clashes: number } {
  const placed: (Rect | null)[] = requests.map(req => (req.manual ? { x: req.manual.x - req.w / 2, y: req.manual.y - req.h / 2, w: req.w, h: req.h } : null));
  const fixed = { polygons: obstacles.polygons, rects: [...obstacles.rects, ...placed.filter((box): box is Rect => box !== null)] };
  const candidates = requests.map(req => (req.manual ? [] : candidatesFor(req, page, fixed, gap, rng)));
  const auto = requests.map((_, i) => i).filter(i => !requests[i]!.manual);
  const scoreOf = new Map<number, number>();
  const clashes = (box: Rect, except: readonly number[]): boolean =>
    auto.some(j => !except.includes(j) && placed[j] !== null && rectsOverlap(box, placed[j]!, gap));
  const firstFree = (i: number, except: readonly number[]): Candidate | null => candidates[i]!.find(c => !clashes(c.box, except)) ?? null;

  const order = [...auto].sort((a, b) => (candidates[a]![0]?.score ?? Infinity) - (candidates[b]![0]?.score ?? Infinity) || a - b);
  for (const i of order) {
    const found = firstFree(i, [i]);
    if (found) {
      placed[i] = found.box;
      scoreOf.set(i, found.score);
    }
  }
  for (let round = 0; round < ROUNDS; round++) {
    let moved = false;
    for (const i of order) {
      const now = scoreOf.get(i) ?? Infinity;
      for (const c of candidates[i]!) {
        if (c.score >= now) break;
        const blocking = auto.filter(j => j !== i && placed[j] !== null && rectsOverlap(c.box, placed[j]!, gap));
        if (blocking.length === 0) {
          placed[i] = c.box;
          scoreOf.set(i, c.score);
          moved = true;
          break;
        }
        if (blocking.length > 1) continue;
        // Two boxes trade: this one takes the place, the one in it moves to its best free one.
        const j = blocking[0]!;
        const old = placed[i];
        placed[i] = c.box;
        const other = firstFree(j, [j]);
        if (other && c.score + other.score < now + (scoreOf.get(j) ?? Infinity)) {
          placed[j] = other.box;
          scoreOf.set(i, c.score);
          scoreOf.set(j, other.score);
          moved = true;
          break;
        }
        placed[i] = old ?? null;
      }
    }
    if (!moved) break;
  }

  let clashCount = 0;
  for (const i of order) {
    if (placed[i]) continue;
    // Every place it gathered is taken: look again with the other boxes where they are.
    const taken = { polygons: obstacles.polygons, rects: [...fixed.rects, ...placed.filter((box): box is Rect => box !== null)] };
    const found = candidatesFor(requests[i]!, page, taken, gap, rng)[0];
    if (found) {
      placed[i] = found.box;
      continue;
    }
    clashCount++;
    placed[i] = leastCovered(requests[i]!, page, taken, gap, rng);
  }
  return { boxes: placed.map(box => box!), clashes: clashCount };
}

/**
 * A box's best free places, best first, none nearly on top of another: random places over the
 * page, and as many again around its own room, where the free gaps worth having are small.
 */
function candidatesFor(req: BoxRequest, page: Rect, obstacles: Obstacles, gap: number, rng: Rng): Candidate[] {
  const own = req.room === undefined ? undefined : obstacles.polygons[req.room];
  const reach = Math.max(req.w, req.h);
  const around = own ? polygonBounds(own) : { x: req.anchor.x, y: req.anchor.y, w: 0, h: 0 };
  const local = clampRect({ x: around.x - req.w - reach, y: around.y - req.h - reach, w: around.w + req.w + reach * 2, h: around.h + req.h + reach * 2 }, page);
  const found: Candidate[] = [];
  for (let i = 0; i < TRIES; i++) {
    const area = i % 2 === 0 || !local || local.w < req.w || local.h < req.h ? page : local;
    const box = { x: area.x + rng() * Math.max(0, area.w - req.w), y: area.y + rng() * Math.max(0, area.h - req.h), w: req.w, h: req.h };
    if (coverage(box, obstacles, gap) === 0) found.push({ box, score: placeScore(box, req, obstacles, gap) });
  }
  found.sort((a, b) => a.score - b.score);
  const near = Math.min(req.w, req.h) * 0.5;
  const out: Candidate[] = [];
  for (const c of found) {
    if (out.some(o => Math.abs(o.box.x - c.box.x) < near && Math.abs(o.box.y - c.box.y) < near)) continue;
    out.push(c);
    if (out.length === CANDIDATES) break;
  }
  return out;
}

function polygonBounds(points: readonly Vec[]): Rect {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** The part of `r` inside `within`, or null when too small to hold anything. */
function clampRect(r: Rect, within: Rect): Rect | null {
  const x = Math.max(r.x, within.x);
  const y = Math.max(r.y, within.y);
  const w = Math.min(r.x + r.w, within.x + within.w) - x;
  const h = Math.min(r.y + r.h, within.y + within.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

function leastCovered(req: BoxRequest, page: Rect, obstacles: Obstacles, gap: number, rng: Rng): Rect {
  let best: Rect = { x: page.x, y: page.y, w: req.w, h: req.h };
  let bestScore = Infinity;
  const spanX = Math.max(0, page.w - req.w);
  const spanY = Math.max(0, page.h - req.h);
  for (let i = 0; i < TRIES; i++) {
    const box = { x: page.x + rng() * spanX, y: page.y + rng() * spanY, w: req.w, h: req.h };
    const score = coverage(box, obstacles, gap) * 1e6 + placeScore(box, req, obstacles, gap);
    if (score < bestScore) {
      best = box;
      bestScore = score;
    }
  }
  return best;
}

/**
 * How far a box is from where it belongs: the gap to its own room, and where another room is
 * nearer, a penalty, since a box beside a neighbour reads as that neighbour's note. The penalty
 * is mostly a fixed price: a room deep inside the map has no place beside it, and its box should
 * not push an outer room's box off the one place that room has.
 */
function placeScore(box: Rect, req: BoxRequest, obstacles: Obstacles, gap: number): number {
  const { polygons } = obstacles;
  const own = req.room === undefined ? undefined : polygons[req.room];
  if (!own) return Math.hypot(box.x + box.w / 2 - req.anchor.x, box.y + box.h / 2 - req.anchor.y);
  const mine = rectPolygonGap(box, own);
  if (req.tail) {
    const from = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    let crossed = 0;
    for (let i = 0; i < polygons.length; i++) {
      if (i !== req.room && segmentMeetsPolygon(from, req.anchor, polygons[i]!)) crossed++;
    }
    for (const r of obstacles.rects) {
      if (segmentMeetsPolygon(from, req.anchor, rectCorners(r))) crossed++;
    }
    return mine + crossed * MISREAD_GAPS * gap;
  }
  let other = Infinity;
  for (let i = 0; i < polygons.length; i++) {
    if (i !== req.room) other = Math.min(other, rectBoundsGap(box, polygons[i]!));
  }
  return other < mine ? mine + MISREAD_GAPS * gap + (mine - other) * 0.5 : mine;
}

/** How many obstacles a box meets. */
function coverage(box: Rect, obstacles: Obstacles, gap: number): number {
  let count = 0;
  for (const r of obstacles.rects) if (rectsOverlap(box, r, gap)) count++;
  const grown = { x: box.x - gap, y: box.y - gap, w: box.w + gap * 2, h: box.h + gap * 2 };
  for (const polygon of obstacles.polygons) if (rectMeetsPolygon(grown, polygon)) count++;
  return count;
}
