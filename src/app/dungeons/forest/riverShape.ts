import type { CellPoint, DungeonLake, DungeonRiver, DungeonRiverBridge } from '../model';
import { subtractRings, unionRings } from '../render/clipShapes';
import { pointInPolygon, pointsBounds, signedArea2, type Bounds } from '../render/geometry';

/**
 * A Forest's rivers and lakes as shapes, in cells, shared by their drawing and their scene. A
 * river's banks lie half its width either side of its middle line; its water reaches them except
 * on the inside of a bend, where a bar of sand and gravel lies (`riverBars`), widest at the bend's
 * apex, as point bars build where the current slows; the outer bank, where it runs fast, is cut
 * steep and the water reaches it. Bends are never tighter than the banks allow (`riverCourse`), so
 * the banks are plain offset lines and never fold.
 */

type Vec = CellPoint;

/** Half a bridge's deck across its length (the deck is a cell wide), in cells. */
export const DECK_HALF = 0.5;
/** The widest a bar is, as a share of the river's width. */
const BAR_SHARE = 0.34;
/** No bar lies in a river narrower than this, in cells: a brook's bends hold none worth drawing. */
const BAR_LEAST_WIDTH = 0.9;
/** How many points either side a bend's curvature is averaged over, so a bar grows and wanes smoothly. */
const BEND_REACH = 8;

/** The unit normal at point `i` of a line, to its left as it runs (the side its heading turns to as it grows). */
export function normalAt(points: readonly Vec[], i: number): Vec {
  const p = points[Math.max(0, i - 1)]!;
  const q = points[Math.min(points.length - 1, i + 1)]!;
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
}

interface Banks {
  /** The banks, half the width out. */
  left: Vec[];
  right: Vec[];
  /** The water's edges: the banks, or the edge of a bar on a bend's inside. */
  leftWater: Vec[];
  rightWater: Vec[];
}

const banksOf = new WeakMap<DungeonRiver, Banks>();

/** A river's banks and the edges of its water. */
function banks(river: DungeonRiver): Banks {
  const kept = banksOf.get(river);
  if (kept) return kept;
  const { points, widths } = river;
  const turn = bends(points);
  const found: Banks = { left: [], right: [], leftWater: [], rightWater: [] };
  points.forEach((p, i) => {
    const n = normalAt(points, i);
    const half = widths[i]! / 2;
    // How sharp the bend is for a river this wide: 0 straight, 1 near the tightest a river turns.
    const bend = Math.max(0, Math.min(1, (Math.abs(turn[i]!) * widths[i]! - 0.08) / 0.3));
    const bar = widths[i]! < BAR_LEAST_WIDTH ? 0 : BAR_SHARE * widths[i]! * bend * bend * (3 - 2 * bend);
    // A bend turning left has its inside, and its bar, on the left.
    const [inLeft, inRight] = turn[i]! > 0 ? [bar, 0] : [0, bar];
    found.left.push({ x: p.x + n.x * half, y: p.y + n.y * half });
    found.right.push({ x: p.x - n.x * half, y: p.y - n.y * half });
    found.leftWater.push({ x: p.x + n.x * (half - inLeft), y: p.y + n.y * (half - inLeft) });
    found.rightWater.push({ x: p.x - n.x * (half - inRight), y: p.y - n.y * (half - inRight) });
  });
  banksOf.set(river, found);
  return found;
}

/** How sharply a line bends at each point, per cell (positive turning towards its left normal), averaged over a short reach. */
export function bends(points: readonly Vec[]): number[] {
  return smoothed(turning(points), BEND_REACH);
}

/** The heading's turn at each point per cell (positive towards the left normal). */
function turning(points: readonly Vec[]): number[] {
  return points.map((_, i) => {
    if (i === 0 || i === points.length - 1) return 0;
    const a = points[i - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const h = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
    const len = (Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - b.x, c.y - b.y)) / 2 || 1;
    return Math.atan2(Math.sin(h), Math.cos(h)) / len;
  });
}

function smoothed(values: readonly number[], reach: number): number[] {
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, i - reach); k <= Math.min(values.length - 1, i + reach); k++) { sum += values[k]!; count += 1; }
    return sum / count;
  });
}

/** Outlines wound as clipping winds an outline, so a union never cancels one against another. */
function wound(ring: Vec[]): Vec[] {
  return signedArea2(ring) < 0 ? ring.reverse() : ring;
}

/** The river's water from point `from` to point `to`, an outline along its water's edges. */
function waterBetween(river: DungeonRiver, from: number, to: number): Vec[] {
  const { leftWater, rightWater } = banks(river);
  return wound([...leftWater.slice(from, to + 1), ...rightWater.slice(from, to + 1).reverse()]);
}

/** The river's water, bank to bar, as one outline. */
export function riverWater(river: DungeonRiver): Vec[] {
  return waterBetween(river, 0, river.points.length - 1);
}

/** The bars on the inside of the river's bends: sand and gravel between the water's edge and the bank. */
export function riverBars(river: DungeonRiver): Vec[][] {
  const { left, right, leftWater, rightWater } = banks(river);
  const bars: Vec[][] = [];
  for (const [bank, edge] of [[left, leftWater], [right, rightWater]] as const) {
    let start = -1;
    for (let i = 0; i <= bank.length; i++) {
      const open = i < bank.length && Math.hypot(bank[i]!.x - edge[i]!.x, bank[i]!.y - edge[i]!.y) > 0.03;
      if (open && start < 0) start = i;
      if (!open && start >= 0) {
        if (i - start >= 4) bars.push(wound([...bank.slice(start, i), ...edge.slice(start, i).reverse()]));
        start = -1;
      }
    }
  }
  return bars;
}

const watersOf = new WeakMap<readonly DungeonRiver[], Vec[][]>();

/** All the floor's river and lake water as one, as clipping gives it (outlines and islands). */
export function floorWater(rivers: readonly DungeonRiver[] | undefined, lakes: readonly DungeonLake[] | undefined): Vec[][] {
  if (!rivers?.length) return [];
  const kept = watersOf.get(rivers);
  if (kept) return kept;
  const water = unionRings([...rivers.map(riverWater), ...(lakes ?? []).map((lake) => wound([...lake.outline]))]);
  watersOf.set(rivers, water);
  return water;
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

/** How many of a river's points one stretch of it holds: about four cells, short enough that a bend's water flows round it. */
const STRETCH = 16;

/** A stretch of moving water and the way it flows there, or a lake, which does not. */
export interface WaterStretch {
  /** As clipping gives them: outlines and holes (islands). */
  rings: Vec[][];
  flow?: Vec;
}

const stretchesOf = new WeakMap<readonly DungeonRiver[], WaterStretch[]>();

/**
 * The floor's water in pieces that each move one way: every lake whole and still, then each river
 * in stretches of about four cells along its water's edges, each with the way the river runs there.
 * A river gives way to the lakes and the rivers before it (a tributary to the river it joins), so no
 * water is in two pieces; stretches meet edge to edge.
 */
export function waterStretches(rivers: readonly DungeonRiver[] | undefined, lakes: readonly DungeonLake[] | undefined): WaterStretch[] {
  if (!rivers?.length) return [];
  const kept = stretchesOf.get(rivers);
  if (kept) return kept;
  const pieces: WaterStretch[] = [];
  const earlier: { rings: Vec[][]; bounds: Bounds }[] = [];
  for (const lake of lakes ?? []) {
    const rings = [wound([...lake.outline])];
    pieces.push({ rings });
    earlier.push({ rings, bounds: pointsBounds(lake.outline) });
  }
  for (const river of rivers) {
    const own: typeof earlier = [];
    const last = river.points.length - 1;
    for (let a = 0; a < last; a += STRETCH) {
      const b = Math.min(last, a + STRETCH);
      const band = waterBetween(river, a, b);
      const bounds = pointsBounds(band);
      const before = earlier.filter((piece) => overlaps(piece.bounds, bounds)).flatMap((piece) => piece.rings);
      const rings = before.length ? subtractRings([band], before) : [band];
      if (!rings.length) continue;
      const dx = river.points[b]!.x - river.points[a]!.x;
      const dy = river.points[b]!.y - river.points[a]!.y;
      const len = Math.hypot(dx, dy) || 1;
      pieces.push({ rings, flow: { x: dx / len, y: dy / len } });
      own.push({ rings, bounds });
    }
    earlier.push(...own);
  }
  stretchesOf.set(rivers, pieces);
  return pieces;
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** How far a point lies from the water, bank to bank and lake shore, in cells: negative in it. */
export interface WaterField {
  distance(x: number, y: number): number;
}

/** The size of the buckets the water's edges are filed in, in cells; a point is measured against its own bucket and those round it. */
const BUCKET = 4;
const NONE: WaterField = { distance: () => Infinity };
const fields = new WeakMap<readonly DungeonRiver[], WaterField>();

/**
 * The rivers' and lakes' field, kept for the list: the drawing asks it a few million times, so the
 * rivers' middle lines (with their half widths) and the lakes' shores lie in a grid of buckets in
 * flat arrays. Beyond a bucket from all water it answers Infinity.
 */
export function waterField(rivers: readonly DungeonRiver[] | undefined, lakes?: readonly DungeonLake[]): WaterField {
  if (!rivers?.length) return NONE;
  const kept = fields.get(rivers);
  if (kept) return kept;
  // Each segment: its ends and how far its water reaches from it, five numbers.
  const segments: number[] = [];
  for (const river of rivers) {
    for (let i = 0; i + 1 < river.points.length; i++) {
      const a = river.points[i]!;
      const b = river.points[i + 1]!;
      segments.push(a.x, a.y, b.x, b.y, (river.widths[i]! + river.widths[i + 1]!) / 4);
    }
  }
  for (const { outline } of lakes ?? []) {
    outline.forEach((a, i) => {
      const b = outline[(i + 1) % outline.length]!;
      segments.push(a.x, a.y, b.x, b.y, 0);
    });
  }
  const field = bucketField(segments, lakes ?? []);
  fields.set(rivers, field);
  return field;
}

function bucketField(segments: readonly number[], lakes: readonly DungeonLake[]): WaterField {
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
  const lakeBounds = lakes.map((lake) => pointsBounds(lake.outline));
  return {
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
      // A lake's shore is measured from both sides: inside the lake the distance counts as in the water.
      for (let k = 0; k < lakes.length; k++) {
        const b = lakeBounds[k]!;
        if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && pointInPolygon(lakes[k]!.outline, x, y)) return -Math.abs(best);
      }
      return best;
    },
  };
}
