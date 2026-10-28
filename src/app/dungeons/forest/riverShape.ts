import type { CellPoint, DungeonRiver, DungeonRiverBridge } from '../model';
import { intersectRings, subtractRings, unionRings } from '../render/clipShapes';
import { pointsBounds, type Bounds } from '../render/geometry';

/**
 * A Forest river's shapes, in cells, shared by its drawing and its scene: its water as outlines,
 * in stretches that each flow their own way, a bridge's deck, and how far a point lies from its
 * water (`riverField`).
 */

type Vec = CellPoint;

/** Half a bridge's deck across its length (the deck is a cell wide), in cells. */
export const DECK_HALF = 0.5;

/** The corners of a disc's outline. */
const DISC = 14;
/** Each river's whole water, which its drawing, liquids, pools and features all ask for. */
const waters = new WeakMap<DungeonRiver, Vec[][]>();

/**
 * The river's water as outlines: the union of a disc at every point and the band between each
 * two, so a tight bend never folds its inner bank over itself, and the outline is where
 * `riverField` reaches 0. May hold holes. Kept for the river.
 */
export function riverRings(river: DungeonRiver): Vec[][] {
  let rings = waters.get(river);
  if (!rings) waters.set(river, (rings = ringsBetween(river, 0, river.points.length - 1)));
  return rings;
}

/** The river's water from point `from` to point `to`, as `riverRings`. */
function ringsBetween(river: DungeonRiver, from: number, to: number): Vec[][] {
  const parts: Vec[][] = [];
  for (let i = from; i <= to; i++) {
    const p = river.points[i]!;
    const r = river.widths[i]! / 2;
    parts.push(Array.from({ length: DISC }, (_, k) => ({ x: p.x + r * Math.cos((2 * Math.PI * k) / DISC), y: p.y + r * Math.sin((2 * Math.PI * k) / DISC) })));
    if (i === to) continue;
    const q = river.points[i + 1]!;
    const s = river.widths[i + 1]! / 2;
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const n = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
    parts.push([
      { x: p.x + n.x * r, y: p.y + n.y * r }, { x: q.x + n.x * s, y: q.y + n.y * s },
      { x: q.x - n.x * s, y: q.y - n.y * s }, { x: p.x - n.x * r, y: p.y - n.y * r },
    ]);
  }
  return unionRings(parts);
}

/** A point on a bridge: `u` cells along it from its first end, `v` across it. */
export function bridgePoint(bridge: DungeonRiverBridge, u: number, v: number): Vec {
  const { at, along, length } = bridge;
  return { x: at.x + along.x * (u - length / 2) - along.y * v, y: at.y + along.y * (u - length / 2) + along.x * v };
}

/** The four corners of a bridge's deck. */
export function deckOf(bridge: DungeonRiverBridge): Vec[] {
  const { length } = bridge;
  return [bridgePoint(bridge, 0, -DECK_HALF), bridgePoint(bridge, length, -DECK_HALF), bridgePoint(bridge, length, DECK_HALF), bridgePoint(bridge, 0, DECK_HALF)];
}

/** How many of a river's points one stretch of it holds: about five cells, short enough that a bend's water flows round it. */
const STRETCH = 12;
/** How far past its water a stretch's band reaches, in cells, so the band holds all of it. */
const BAND_MARGIN = 1;

const stretchesOf = new WeakMap<readonly DungeonRiver[], RiverStretch[]>();

/** A stretch of a river's water and the way it flows there. */
export interface RiverStretch {
  /** As clipping gives them: outlines and holes (islands). */
  rings: Vec[][];
  flow: Vec;
}

/**
 * The rivers' water in stretches of about five cells, each with the way the river runs there; a
 * tributary's stretches end at the water of the river it joins, so no water is in two stretches.
 * Each stretch is the water within a band along the river cut square at its ends, so stretches
 * meet edge to edge.
 */
export function riverStretches(rivers: readonly DungeonRiver[]): RiverStretch[] {
  const kept = stretchesOf.get(rivers);
  if (kept) return kept;
  const stretches: RiverStretch[] = [];
  // The earlier rivers' water stretch by stretch, so a tributary is cut only by the stretches it reaches.
  const earlier: { rings: Vec[][]; bounds: Bounds }[] = [];
  for (const river of rivers) {
    const own: typeof earlier = [];
    const { points } = river;
    const last = points.length - 1;
    for (let a = 0; a < last; a += STRETCH) {
      const b = Math.min(last, a + STRETCH);
      // The water near the stretch alone: clipping the whole river for every stretch cost a scene a third of a second.
      const band = riverBand(river, a, b);
      const near = intersectRings(ringsBetween(river, Math.max(0, a - 3), Math.min(last, b + 3)), [band]);
      // A tributary's water gives way to the river it joins, which only its last stretches reach.
      const bounds = pointsBounds(band);
      const joined = earlier.filter((stretch) => overlaps(stretch.bounds, bounds)).flatMap((stretch) => stretch.rings);
      const rings = joined.length && near.length ? subtractRings(near, joined) : near;
      if (!rings.length) continue;
      const dx = points[b]!.x - points[a]!.x;
      const dy = points[b]!.y - points[a]!.y;
      const len = Math.hypot(dx, dy) || 1;
      stretches.push({ rings, flow: { x: dx / len, y: dy / len } });
      own.push({ rings, bounds });
    }
    earlier.push(...own);
  }
  stretchesOf.set(rivers, stretches);
  return stretches;
}

/** The band from point `a` to point `b` that holds the river's water there, square across at both ends; at the river's own ends it reaches past the water's round end. */
function riverBand(river: DungeonRiver, a: number, b: number): Vec[] {
  const left: Vec[] = [];
  const right: Vec[] = [];
  const last = river.points.length - 1;
  for (let i = a; i <= b; i++) {
    const n = normalAt(river.points, i);
    const half = river.widths[i]! / 2 + BAND_MARGIN;
    // Along the river, out past its end: the normal turned a quarter, backwards at the start.
    const out = i === 0 ? -half : i === last ? half : 0;
    const p = { x: river.points[i]!.x + n.y * out, y: river.points[i]!.y - n.x * out };
    left.push({ x: p.x + n.x * half, y: p.y + n.y * half });
    right.push({ x: p.x - n.x * half, y: p.y - n.y * half });
  }
  return [...left, ...right.reverse()];
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** The unit normal at point `i` of a line, to its left as it runs. */
export function normalAt(points: readonly Vec[], i: number): Vec {
  const p = points[Math.max(0, i - 1)]!;
  const q = points[Math.min(points.length - 1, i + 1)]!;
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
}

/** How far a point lies from the edge of any river's water, in cells: negative in the water. */
interface RiverField {
  distance(x: number, y: number): number;
}

/** The size of the buckets a river's stretches are filed in, in cells; a point is measured against its own bucket and those round it. */
const BUCKET = 4;
const NONE: RiverField = { distance: () => Infinity };
const fields = new WeakMap<readonly DungeonRiver[], RiverField>();

/**
 * The rivers' field, kept for the list: the drawing asks it a few million times, so its segments
 * lie in a grid of buckets in flat arrays. Beyond a bucket from every river it answers Infinity.
 */
export function riverField(rivers: readonly DungeonRiver[] | undefined): RiverField {
  if (!rivers?.length) return NONE;
  const kept = fields.get(rivers);
  if (kept) return kept;
  // Each segment: its ends and its half width, five numbers.
  const segments: number[] = [];
  for (const river of rivers) {
    for (let i = 0; i + 1 < river.points.length; i++) {
      const a = river.points[i]!;
      const b = river.points[i + 1]!;
      segments.push(a.x, a.y, b.x, b.y, (river.widths[i]! + river.widths[i + 1]!) / 4);
    }
  }
  const count = segments.length / 5;
  const cell = (k: number): [number, number] => [Math.floor((segments[k * 5]! + segments[k * 5 + 2]!) / 2 / BUCKET), Math.floor((segments[k * 5 + 1]! + segments[k * 5 + 3]!) / 2 / BUCKET)];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k < count; k++) {
    const [bx, by] = cell(k);
    x0 = Math.min(x0, bx); y0 = Math.min(y0, by); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
  }
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  // Buckets as offsets into one list of segment indices.
  const starts = new Int32Array(cols * rows + 1);
  for (let k = 0; k < count; k++) { const [bx, by] = cell(k); starts[(by - y0) * cols + (bx - x0) + 1]! += 1; }
  for (let b = 0; b < cols * rows; b++) starts[b + 1]! += starts[b]!;
  const filled = starts.slice(0, cols * rows);
  const order = new Int32Array(count);
  for (let k = 0; k < count; k++) { const [bx, by] = cell(k); order[filled[(by - y0) * cols + (bx - x0)]!++] = k; }
  const flat = Float64Array.from(segments);
  const field: RiverField = {
    distance: (x, y) => {
      const bx = Math.floor(x / BUCKET) - x0;
      const by = Math.floor(y / BUCKET) - y0;
      let best = Infinity;
      for (let j = Math.max(0, by - 1); j <= Math.min(rows - 1, by + 1); j++) for (let i = Math.max(0, bx - 1); i <= Math.min(cols - 1, bx + 1); i++) {
        const bucket = j * cols + i;
        for (let n = starts[bucket]!; n < starts[bucket + 1]!; n++) {
          const o = order[n]! * 5;
          const ax = flat[o]!, ay = flat[o + 1]!;
          const dx = flat[o + 2]! - ax;
          const dy = flat[o + 3]! - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
          const ex = x - ax - dx * t;
          const ey = y - ay - dy * t;
          best = Math.min(best, Math.sqrt(ex * ex + ey * ey) - flat[o + 4]!);
        }
      }
      return best;
    },
  };
  fields.set(rivers, field);
  return field;
}
