import { cellKey, holdsStairs } from '../geometry';
import type { CellPoint, DungeonFloor, DungeonRiver, DungeonRiverBridge, DungeonRoom } from '../model';
import { floorStream, type Rng } from '../rng';
import { fractalNoise } from '../water/noise';
import { floorCells } from '../water/wetGrid';
import { normalAt, riverField } from './riverShape';

/**
 * A Forest's rivers. The main river enters beyond one edge of the map and leaves beyond the
 * opposite one, passing through one or two of the largest clearings on the way, so it shapes the
 * fight; between them it meanders through the woods, where the trees part for it. It widens and
 * narrows as it goes; sometimes a narrower tributary comes in from a side and joins it. Where a
 * river crosses a clearing deep enough to stop a walk, a bridge carries the way over it; where it
 * runs shallow, it is a ford. Pure, deterministic in the seed.
 */

type Vec = CellPoint;

/** How far beyond the rooms a river begins and ends, so it runs off the map's edge. */
const BEYOND = 10;
/** The spacing of a river's points, in cells. */
const STEP = 0.4;
/** A stretch this wide or wider cannot be waded: a clearing it crosses gets a bridge. */
const DEEP = 1.3;
/** A bridge reaches this far onto the banks on either side. */
const BRIDGE_REACH = 0.6;
/** Two bridges stand at least this far apart, in cells. */
const BRIDGES_APART = 10;

/** What the tags ask of the water: no river, the usual chance of one, or always one, and how wide. */
interface RiverPlan {
  width: number;
  /** The chance of a tributary. */
  tributary: number;
}

function riverPlan(tags: ReadonlySet<string>, rng: Rng): RiverPlan | null {
  if (tags.has('dry')) return null;
  const flooded = tags.has('flooded');
  const wet = flooded || tags.has('wet');
  if (!wet && rng() > 0.75) return null;
  const width = flooded ? 2.4 + rng() * 1.2 : wet ? 1.5 + rng() * 1.3 : 0.9 + rng() * 1.6;
  return { width, tributary: wet ? 0.6 : 0.4 };
}

/** How many courses are tried before a floor goes without a river: one that floods stairs or a way down is refused. */
const TRIES = 6;
/** A river keeps this far from stairs and the ways down, in cells. */
const CLEAR = 1;

type RiverFloor = Pick<DungeonFloor, 'rooms' | 'stairs' | 'terrain' | 'waterCells'>;

export function forestRivers(floor: RiverFloor, seed: number, tags: ReadonlySet<string>): DungeonRiver[] {
  const plan = riverPlan(tags, floorStream(seed, 'water', 0, 'river'));
  if (!plan || floor.rooms.length === 0) return [];
  const kept = keptCells(floor);
  for (let k = 0; k < TRIES; k++) {
    const rivers = course(floor, plan, floorStream(seed, 'water', 0, `river-${k}`));
    const field = riverField(rivers);
    if (kept.every((c) => field.distance(c.x, c.y) > CLEAR)) return withBridges(rivers, floor);
  }
  return [];
}

/** The middles of the cells no river may cover: stairs and the ways down to the caves. */
function keptCells(floor: RiverFloor): Vec[] {
  const cells: Vec[] = [];
  for (const s of floor.stairs) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) cells.push({ x: x + 0.5, y: y + 0.5 });
  for (const piece of floor.terrain) if (piece.opening !== undefined) for (const c of piece.cells) cells.push({ x: c.x + 0.5, y: c.y + 0.5 });
  return cells;
}

function course(floor: RiverFloor, plan: RiverPlan, rng: Rng): DungeonRiver[] {
  const bounds = boundsOf(floor.rooms);
  const across = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
  const clearings = largest(floor.rooms, floor.stairs).slice(0, 4);
  const through = clearings.filter(() => rng() < 0.6).slice(0, 2);
  if (through.length === 0 && clearings[0]) through.push(clearings[0]);
  through.sort((a, b) => (across ? a.x - b.x : a.y - b.y));
  const ways = through.map((room) => ({ x: room.x + room.w * (0.3 + rng() * 0.4), y: room.y + room.h * (0.3 + rng() * 0.4) }));
  // Small clearings only: the river crosses the woods through the floor's middle.
  if (ways.length === 0) ways.push({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 });
  const first = ways[0]!;
  const last = ways[ways.length - 1]!;
  const start = across ? { x: bounds.minX - BEYOND, y: first.y + (rng() - 0.5) * 10 } : { x: first.x + (rng() - 0.5) * 10, y: bounds.minY - BEYOND };
  const end = across ? { x: bounds.maxX + BEYOND, y: last.y + (rng() - 0.5) * 10 } : { x: last.x + (rng() - 0.5) * 10, y: bounds.maxY + BEYOND };
  const main = shaped([start, ...ways, end], plan.width, rng);
  const rivers: DungeonRiver[] = [main];
  if (rng() < plan.tributary) {
    const join = main.points[Math.floor(main.points.length * (0.3 + rng() * 0.4))]!;
    const side = rng() < 0.5 ? -1 : 1;
    const from = across
      ? { x: join.x + (rng() - 0.5) * 16, y: side < 0 ? bounds.minY - BEYOND : bounds.maxY + BEYOND }
      : { x: side < 0 ? bounds.minX - BEYOND : bounds.maxX + BEYOND, y: join.y + (rng() - 0.5) * 16 };
    rivers.push(shaped([from, join], Math.max(0.6, plan.width * 0.5), rng));
  }
  return rivers;
}

/** The rooms that hold no stairs, largest first: a river's clearings. */
function largest(rooms: readonly DungeonRoom[], stairs: DungeonFloor['stairs']): DungeonRoom[] {
  return rooms.filter((room) => room.w >= 5 && room.h >= 5 && !holdsStairs(room, stairs)).sort((a, b) => b.w * b.h - a.w * a.h);
}

function boundsOf(rooms: readonly DungeonRoom[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: Math.min(...rooms.map((r) => r.x)),
    minY: Math.min(...rooms.map((r) => r.y)),
    maxX: Math.max(...rooms.map((r) => r.x + r.w)),
    maxY: Math.max(...rooms.map((r) => r.y + r.h)),
  };
}

/** A river through `ways`: walked in small steps, swung from side to side by slow noise, smoothed, and of a width that wanders round `width`. */
function shaped(ways: readonly Vec[], width: number, rng: Rng): DungeonRiver {
  const line: Vec[] = [];
  for (let k = 0; k + 1 < ways.length; k++) {
    const a = ways[k]!;
    const b = ways[k + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5));
    for (let i = 0; i < n; i++) line.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  }
  line.push(ways[ways.length - 1]!);
  const swing = fractalNoise(rng, 3, 0.45, 12);
  const amount = 2.2 + width * 0.8;
  let s = 0;
  const meandering = line.map((p, i) => {
    if (i > 0) s += Math.hypot(p.x - line[i - 1]!.x, p.y - line[i - 1]!.y);
    const n = normalAt(line, i);
    // Held at its ends, so a tributary still meets the river where it joins it.
    const hold = Math.min(1, i / 6, (line.length - 1 - i) / 6);
    const off = swing(s, 0) * amount * hold;
    return { x: p.x + n.x * off, y: p.y + n.y * off };
  });
  const points = resampled(chaikin(chaikin(chaikin(meandering))), STEP);
  const breadth = fractalNoise(rng, 2, 0.5, 14);
  const widths = points.map((_, i) => Math.max(0.55, width * Math.max(0.6, Math.min(1.45, 1 + 1.1 * breadth(i * STEP, 7.3)))));
  return { points, widths, bridges: [] };
}

/** Chaikin's corner cutting, ends kept. */
function chaikin(points: readonly Vec[]): Vec[] {
  const out: Vec[] = [points[0]!];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** Points every `step` cells along the line. */
function resampled(points: readonly Vec[], step: number): Vec[] {
  const out: Vec[] = [points[0]!];
  let carry = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carry;
    while (d <= len) {
      out.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
      d += step;
    }
    carry = len - (d - step);
  }
  return out;
}

/**
 * The rivers with their bridges: where a river too deep to wade runs through a clearing, a bridge
 * in the middle of that stretch, both its ends on the clearing's dry ground (never in a pool or
 * another river's water), and bridges well apart. Shallower stretches are fords.
 */
function withBridges(rivers: readonly DungeonRiver[], floor: RiverFloor): DungeonRiver[] {
  const ground = new Set(floorCells(floor.rooms).map((c) => cellKey(c.x, c.y)));
  for (const c of floor.waterCells) ground.delete(cellKey(c.x, c.y));
  const dry = (p: Vec): boolean => ground.has(cellKey(Math.floor(p.x), Math.floor(p.y)));
  const field = riverField(rivers);
  const placed: Vec[] = [];
  return rivers.map((river) => {
    const bridges: DungeonRiverBridge[] = [];
    for (const run of dryRuns(river.points, dry)) {
      const usable = run.map((i) => bridgeAt(river, i, dry, field)).filter((bridge): bridge is DungeonRiverBridge => bridge !== null);
      const bridge = usable[Math.floor(usable.length / 2)];
      if (!bridge || placed.some((p) => Math.hypot(p.x - bridge.at.x, p.y - bridge.at.y) < BRIDGES_APART)) continue;
      bridges.push(bridge);
      placed.push(bridge.at);
    }
    return { ...river, bridges };
  });
}

/** The runs of a line's points that lie on dry ground, as lists of their indices. */
function dryRuns(points: readonly Vec[], dry: (p: Vec) => boolean): number[][] {
  const runs: number[][] = [[]];
  points.forEach((p, i) => {
    if (dry(p)) runs[runs.length - 1]!.push(i);
    else if (runs[runs.length - 1]!.length) runs.push([]);
  });
  return runs.filter((run) => run.length > 0);
}

/** A bridge across the river at its point `i`, where the river is too deep to wade there and both ends of the bridge stand on dry ground. */
function bridgeAt(river: DungeonRiver, i: number, dry: (p: Vec) => boolean, field: { distance(x: number, y: number): number }): DungeonRiverBridge | null {
  const width = river.widths[i]!;
  if (width < DEEP) return null;
  const at = river.points[i]!;
  const along = normalAt(river.points, i);
  const length = width + 2 * BRIDGE_REACH;
  const ends = [-1, 1].map((side) => ({ x: at.x + along.x * side * (length / 2), y: at.y + along.y * side * (length / 2) }));
  return ends.every((end) => dry(end) && field.distance(end.x, end.y) > 0.1) ? { at, along, length } : null;
}
