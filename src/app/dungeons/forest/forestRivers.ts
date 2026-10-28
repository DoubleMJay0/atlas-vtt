import { cellKey, holdsStairs } from '../geometry';
import type { CellPoint, DungeonFloor, DungeonLake, DungeonRiver, DungeonRiverBridge, DungeonRoom } from '../model';
import { floorStream, type Rng } from '../rng';
import { fractalNoise } from '../water/noise';
import { floorCells } from '../water/wetGrid';
import { lakeOutline } from './lakeShape';
import { COURSE_STEP, riverCourse } from './riverCourse';
import { bends, normalAt, waterField } from './riverShape';

/**
 * A Forest's water, laid as rivers lie. The main river comes in beyond one edge of the map and
 * leaves beyond the other, meandering (`riverCourse`) through one or two of the largest clearings,
 * so it shapes the fight. Its width holds steady along a reach, a little wider in its bends and
 * wider again below a confluence. Now and then it flows into a lake, which the river drains again
 * on the far side or does not; now and then a narrower tributary joins it from a side, meeting it
 * at an acute angle that points downstream, as rivers join. Where a river too deep to wade crosses
 * a clearing, a footbridge spans its straightest reach there, where rivers are bridged; shallower
 * water is forded. Pure, deterministic in the seed.
 */

type Vec = CellPoint;

/** How far beyond the rooms a river begins and ends, so it runs off the map's edge. */
const BEYOND = 10;
/** A river this wide or wider cannot be waded: a clearing it crosses gets a bridge. */
const DEEP = 1.3;
/** A bridge reaches this far onto the banks on either side. */
const BRIDGE_REACH = 0.6;
/** Two bridges stand at least this far apart, in cells. */
const BRIDGES_APART = 10;
/** How many courses are tried before a floor goes without water: one that floods stairs or a way down is refused. */
const TRIES = 6;
/** Water keeps this far from stairs and the ways down, in cells. */
const CLEAR = 1;
/** How much wider a river runs below where a tributary joins it. */
const BELOW_CONFLUENCE = 1.15;

/** A Forest floor's rivers (the main river first) and the lakes they flow into. */
export interface ForestWater {
  rivers: DungeonRiver[];
  lakes: DungeonLake[];
}

interface WaterPlan {
  width: number;
  /** The swing of the main river's heading at a bend's crossing, in radians. */
  swing: number;
  /** The chances of a tributary and of a lake. */
  tributary: number;
  lake: number;
}

/** What the tags ask of the water: no river, the usual chance of one, or always one, and how wide. */
function waterPlan(tags: ReadonlySet<string>, rng: Rng): WaterPlan | null {
  if (tags.has('dry')) return null;
  const flooded = tags.has('flooded');
  const wet = flooded || tags.has('wet');
  if (!wet && rng() > 0.75) return null;
  const width = flooded ? 2.2 + rng() * 1.2 : wet ? 1.4 + rng() * 1.2 : 0.9 + rng() * 1.3;
  return { width, swing: 0.9 + rng() * 0.7, tributary: wet ? 0.6 : 0.4, lake: flooded ? 0.6 : wet ? 0.45 : 0.3 };
}

type RiverFloor = Pick<DungeonFloor, 'rooms' | 'stairs' | 'terrain' | 'waterCells'>;

export function forestWater(floor: RiverFloor, seed: number, tags: ReadonlySet<string>): ForestWater {
  const plan = waterPlan(tags, floorStream(seed, 'water', 0, 'river'));
  if (!plan || floor.rooms.length === 0) return { rivers: [], lakes: [] };
  const kept = keptCells(floor);
  for (let k = 0; k < TRIES; k++) {
    const water = course(floor, plan, floorStream(seed, 'water', 0, `river-${k}`));
    const field = waterField(water.rivers, water.lakes);
    if (kept.every((c) => field.distance(c.x, c.y) > CLEAR)) return { ...water, rivers: withBridges(water, floor) };
  }
  return { rivers: [], lakes: [] };
}

/** The middles of the cells no water may cover: stairs and the ways down to the caves. */
function keptCells(floor: RiverFloor): Vec[] {
  const cells: Vec[] = [];
  for (const s of floor.stairs) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) cells.push({ x: x + 0.5, y: y + 0.5 });
  for (const piece of floor.terrain) if (piece.opening !== undefined) for (const c of piece.cells) cells.push({ x: c.x + 0.5, y: c.y + 0.5 });
  return cells;
}

function course(floor: RiverFloor, plan: WaterPlan, rng: Rng): ForestWater {
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
  let line = riverCourse([start, ...ways, end], plan, rng);
  const lakes: DungeonLake[] = [];
  if (rng() < plan.lake) {
    const lake = lakeOn(line, plan.width, rng);
    lakes.push({ outline: lake.outline });
    // A lake no river drains: the river ends a little way into it.
    if (!lake.drained) line = line.slice(0, lake.mouth);
  }
  const widths = widthsAlong(line, plan.width, rng);
  const rivers: DungeonRiver[] = [{ points: line, widths, bridges: [] }];
  if (rng() < plan.tributary) {
    const joining = tributary(line, widths, plan, bounds, rng);
    if (joining) {
      rivers.push(joining.river);
      // Below the confluence the river carries both: wider, over a few cells.
      for (let i = joining.at; i < widths.length; i++) widths[i] = widths[i]! * (1 + (BELOW_CONFLUENCE - 1) * Math.min(1, (i - joining.at) / 16));
    }
  }
  return { rivers, lakes };
}

/** The way a line runs at its point `i`, in radians. */
function headingAt(line: readonly Vec[], i: number): number {
  const n = normalAt(line, i);
  return Math.atan2(-n.x, n.y);
}

/** A lake on the river's lower course, longest the way the river runs; where the river ends in it (`mouth`, a point a little inside) and whether the river flows on out of it. */
function lakeOn(line: readonly Vec[], width: number, rng: Rng): { outline: Vec[]; mouth: number; drained: boolean } {
  const at = Math.floor(line.length * (0.55 + rng() * 0.25));
  const length = (5 + rng() * 5) * (0.75 + width * 0.2);
  const breadth = length * (0.55 + rng() * 0.25);
  // The river reaches the lake's near end at `at`: its middle lies on downstream.
  const centre = line[Math.min(line.length - 1, at + Math.round((length * 0.45) / COURSE_STEP))]!;
  const outline = lakeOutline(centre, headingAt(line, at), length, breadth, rng);
  return { outline, mouth: Math.min(line.length, at + Math.round((width + 1) / COURSE_STEP)), drained: rng() < 0.5 };
}

/** A river's widths: steady along a reach with a slow drift, a little wider where it bends. */
function widthsAlong(line: readonly Vec[], width: number, rng: Rng): number[] {
  const drift = fractalNoise(rng, 2, 0.5, 30);
  const bent = bends(line);
  return line.map((_, i) => width * (1 + 0.18 * drift(i * COURSE_STEP, 3.1)) * (1 + 0.2 * Math.min(1, Math.abs(bent[i]!) * width * 2)));
}

/**
 * A tributary joining the river on its upper half: it leaves the confluence upstream at 35° to 60°
 * off the river's own way, towards a side of the map, and is laid from there to beyond the map's
 * edge, then turned round to flow down into the river. None where it would cross the river first.
 */
function tributary(line: readonly Vec[], widths: readonly number[], plan: WaterPlan, bounds: Bounds, rng: Rng): { river: DungeonRiver; at: number } | null {
  const at = Math.floor(line.length * (0.25 + rng() * 0.3));
  const join = line[at]!;
  const side = rng() < 0.5 ? -1 : 1;
  const upstream = headingAt(line, at) + Math.PI + side * ((35 + rng() * 25) * Math.PI) / 180;
  const reach = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) + BEYOND;
  const source = { x: join.x + Math.cos(upstream) * reach, y: join.y + Math.sin(upstream) * reach };
  const width = Math.max(0.6, plan.width * (0.45 + rng() * 0.2));
  const points = riverCourse([join, source], { width, swing: plan.swing * 0.9 }, rng, upstream).reverse();
  // It meets the river once, where it joins it.
  const main = waterField([{ points: [...line], widths: [...widths], bridges: [] }]);
  const clear = points.length - Math.ceil((widths[at]! + width) / COURSE_STEP);
  if (points.slice(0, clear).some((p) => main.distance(p.x, p.y) < 0.4)) return null;
  return { river: { points, widths: widthsAlong(points, width, rng), bridges: [] }, at };
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The rooms that hold no stairs, largest first: a river's clearings. */
function largest(rooms: readonly DungeonRoom[], stairs: DungeonFloor['stairs']): DungeonRoom[] {
  return rooms.filter((room) => room.w >= 5 && room.h >= 5 && !holdsStairs(room, stairs)).sort((a, b) => b.w * b.h - a.w * a.h);
}

function boundsOf(rooms: readonly DungeonRoom[]): Bounds {
  return {
    minX: Math.min(...rooms.map((r) => r.x)),
    minY: Math.min(...rooms.map((r) => r.y)),
    maxX: Math.max(...rooms.map((r) => r.x + r.w)),
    maxY: Math.max(...rooms.map((r) => r.y + r.h)),
  };
}

/**
 * The rivers with their bridges: where a river too deep to wade runs through a clearing, a bridge
 * on the straightest reach of that stretch, both its ends on the clearing's dry ground (never in a
 * pool, a lake or another river's water), and bridges well apart. Shallower stretches are fords.
 */
function withBridges({ rivers, lakes }: ForestWater, floor: RiverFloor): DungeonRiver[] {
  const ground = new Set(floorCells(floor.rooms).map((c) => cellKey(c.x, c.y)));
  for (const c of floor.waterCells) ground.delete(cellKey(c.x, c.y));
  const dry = (p: Vec): boolean => ground.has(cellKey(Math.floor(p.x), Math.floor(p.y)));
  const field = waterField(rivers, lakes);
  const placed: Vec[] = [];
  return rivers.map((river) => {
    const bent = bends(river.points);
    const bridges: DungeonRiverBridge[] = [];
    for (const run of dryRuns(river.points, dry)) {
      // Away from the run's ends, on its straightest point that takes a bridge.
      const middle = run.slice(Math.floor(run.length * 0.2), Math.ceil(run.length * 0.8)).sort((a, b) => Math.abs(bent[a]!) - Math.abs(bent[b]!));
      const bridge = middle.map((i) => bridgeAt(river, i, dry, field)).find((found): found is DungeonRiverBridge => found !== null);
      if (!bridge || placed.some((p) => Math.hypot(p.x - bridge.at.x, p.y - bridge.at.y) < BRIDGES_APART)) continue;
      bridges.push(bridge);
      placed.push(bridge.at);
    }
    return { ...river, bridges };
  });
}

/** The runs of a line's points that lie on dry ground, as lists of their indices: two cells and longer. */
function dryRuns(points: readonly Vec[], dry: (p: Vec) => boolean): number[][] {
  const runs: number[][] = [[]];
  points.forEach((p, i) => {
    if (dry(p)) runs[runs.length - 1]!.push(i);
    else if (runs[runs.length - 1]!.length) runs.push([]);
  });
  return runs.filter((run) => run.length * COURSE_STEP >= 2);
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
