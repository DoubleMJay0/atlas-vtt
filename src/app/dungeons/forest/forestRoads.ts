import { cellKey, doorCells, floorCellsOf } from '../geometry';
import type { CellPoint, DungeonFloor, DungeonRiver, DungeonRiverBridge, DungeonRoad } from '../model';
import { pointInPolygon } from '../render/geometry';
import { floorStream, type Rng } from '../rng';
import { fractalNoise } from '../water/noise';
import type { ForestWater } from './forestRivers';
import { lineField, type LineField } from './lineField';
import { wayCentre, wayOutsOf, wayPoint, type WayOut } from '../render/cave/mouth/wayOut';
import { cheapestRoute, type CostGrid } from './roadRoute';
import { bends, normalAt, waterField } from './riverShape';

/**
 * A Forest's roads, laid as old roads are: a road comes in beyond one edge of the map and leaves
 * beyond another, since a road always leads somewhere, and it is the way in: it runs through the
 * map's entrances and their trails, so no trail fades into the woods; it takes the open ground of the clearings
 * where it can and cuts through the woods where it must, goes round lakes and pools, and crosses a
 * river only where its way leads over it, at a narrow straight reach and square to it, over a
 * bridge as wide as the road with straight approaches either side. Its line bends gently and never
 * zigzags (turning costs, `roadRoute`). Most are cart roads, worn to two ruts; some footpaths. Now
 * and then a footpath leaves the road for a third edge. These crossings are the map's only bridges,
 * two at most. Pure, deterministic in the seed.
 */

type Vec = CellPoint;

/** How far beyond the rooms' extent a road begins and ends: past the map's margin, so it runs off the map. */
const BEYOND = 5;
/** What crossing a cell costs: an entrance's trail (a road keeps to it where water does not turn it aside), open ground, woods, the woods beyond the rooms' extent (a road only passes there to leave the map, never runs along its edge), the bank beside water (a road keeps a little off it), a pool, a river's water (bridged where crossed), a lake. */
const COST = { trail: 0.4, open: 1, woods: 2.6, margin: 6, bank: 4, pool: 100, river: 90, lake: Infinity } as const;
/** How near the water a cell's middle lies to hold water (any of it, so a brook between two cells' middles is crossed too) and to count as its bank, in cells: a road keeps far enough off that its curves never dip into a river it runs beside. */
const WET = 0.45;
const BANK = 1.5;
/** A branch runs at least this many cells before it meets the road. */
const SHORTEST_BRANCH = 8;
/** At most this many bridges on a map: a road that would cross more is laid again or not at all. */
const MOST_BRIDGES = 2;
/** How many edge-to-edge ways are tried after the ways through the entrances. */
const EDGE_PLANS = 6;
/** Two bridges stand at least this far apart, in cells. */
const BRIDGES_APART = 8;
/** How many ways are tried for each road. */
const TRIES = 4;
/** A bridge reaches this far onto the banks on either side, and its approach runs straight this far beyond, in cells. */
const BRIDGE_REACH = 0.6;
const APPROACH = 1.4;
/** How many of the route's cells before and after a bridge's approach the route gives way to it. */
const LEAD_IN = 2;
/** How far a road's line wanders either way of the route, in cells. */
const WANDER = 0.35;

/** A Forest floor's roads, and its rivers with the bridges the roads cross them on. */
export interface ForestRoads {
  roads: DungeonRoad[];
  rivers: DungeonRiver[];
}

export function forestRoads(floor: DungeonFloor, water: ForestWater, seed: number, tags: ReadonlySet<string>): ForestRoads {
  const rng = floorStream(seed, 'water', 0, 'roads');
  // The trails out of the entrances, as the drawing lays them (`visibleDungeon`: the entry floor's seed is the dungeon's).
  const ways = wayOutsOf({ ...floor, forest: true }, floor.doors, seed);
  // A map with ways in always has a road through them: a trail must lead somewhere.
  if (floor.rooms.length === 0 || rng() > (ways.length || tags.has('inhabited') ? 1 : 0.8)) return { roads: [], rivers: water.rivers };
  const ground = groundOf(floor, water, ways);
  const kinds = { cart: tags.has('inhabited') || rng() < 0.7 };
  const width = kinds.cart ? 1.3 + rng() * 0.4 : 0.65 + rng() * 0.2;
  const bridges: Bridged[] = [];
  const roads: DungeonRoad[] = [];
  // Through both entrances where it can, else through one, else across: the first way that can be laid.
  let main: Vec[] | null = null;
  let sides: number[] = [];
  for (const plan of roadPlans(ground, ways, rng)) {
    main = layRoad(ground, water, plan.legs, width, bridges, rng);
    sides = plan.sides;
    if (main) break;
  }
  if (main) {
    roads.push({ points: main, width, ruts: kinds.cart });
    // An entrance the road does not pass gets a footpath of its own, from the map's edge along its trail on to the road.
    const missed = ways.filter((way) => !main.some((p) => Math.hypot(p.x - way.mouth.at.x, p.y - way.mouth.at.y) < 2.5));
    // Where it cannot join the road without doubling back, it ends at the entrance: the clearings beyond lead on.
    for (const way of missed) {
      const legs = [[edgeBeyond(ground, way).edge], [mouthCell(way)]];
      const path = layRoad(ground, water, legs, 0.7, bridges, rng, main) ?? layRoad(ground, water, legs, 0.7, bridges, rng);
      if (path) roads.push({ points: path, width: 0.7, ruts: false });
    }
    // A footpath off the road to an edge the road does not reach, now and then.
    if (!missed.length && rng() < 0.35) {
      const free = [0, 1, 2, 3].filter((side) => !sides.includes(side));
      const branch = layRoad(ground, water, [[edgeCell(ground, free[Math.floor(rng() * free.length)]!, rng)]], 0.7, bridges, rng, main);
      if (branch) roads.push({ points: branch, width: 0.7, ruts: false });
    }
  }
  const rivers = water.rivers.map((river, k) => ({ ...river, bridges: bridges.filter((b) => b.river === k).map((b) => b.bridge) }));
  return { roads, rivers };
}

/** A bridge and the river it spans. */
interface Bridged {
  river: number;
  bridge: DungeonRiverBridge;
}

interface Ground {
  grid: CostGrid;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** What crossing each cell costs, over the rooms' extent and `BEYOND` round it. */
function groundOf(floor: DungeonFloor, { rivers, lakes }: ForestWater, ways: readonly WayOut[]): Ground {
  const inner = { minX: Math.min(...floor.rooms.map((r) => r.x)), minY: Math.min(...floor.rooms.map((r) => r.y)), maxX: Math.max(...floor.rooms.map((r) => r.x + r.w)), maxY: Math.max(...floor.rooms.map((r) => r.y + r.h)) };
  const minX = inner.minX - BEYOND;
  const minY = inner.minY - BEYOND;
  const maxX = inner.maxX + BEYOND;
  const maxY = inner.maxY + BEYOND;
  const open = new Set([...floor.rooms.flatMap((room) => floorCellsOf(room)), ...floor.doors.flatMap(doorCells), ...(floor.openGround ?? [])].map((c) => cellKey(c.x, c.y)));
  const pools = new Set(floor.waterCells.map((c) => cellKey(c.x, c.y)));
  const blocked = new Set([...floor.stairs.flatMap((s) => Array.from({ length: s.w * s.h }, (_, k) => ({ x: s.x + (k % s.w), y: s.y + Math.floor(k / s.w) }))), ...floor.terrain.filter((p) => p.opening !== undefined).flatMap((p) => p.cells)].map((c) => cellKey(c.x, c.y)));
  const field = waterField(rivers, lakes);
  const trails = new Set(ways.flatMap(trailCells).map((c) => cellKey(c.x, c.y)));
  const w = maxX - minX;
  const h = maxY - minY;
  const cost = new Float32Array(w * h);
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const key = cellKey(x, y);
      const cx = x + 0.5;
      const cy = y + 0.5;
      const d = field.distance(cx, cy);
      const wet = d < WET;
      const lake = wet && (lakes ?? []).some((l) => pointInPolygon(l.outline, cx, cy));
      const margin = x < inner.minX || y < inner.minY || x >= inner.maxX || y >= inner.maxY;
      cost[(y - minY) * w + (x - minX)] = blocked.has(key) || lake ? COST.lake : wet ? COST.river : pools.has(key) ? COST.pool : d < BANK ? COST.bank : trails.has(key) ? COST.trail : open.has(key) ? COST.open : margin ? COST.margin : COST.woods;
    }
  }
  return { grid: { x0: minX, y0: minY, w, h, cost }, bounds: { minX, minY, maxX, maxY } };
}

/**
 * The ways a road may pass, the best first, each its legs in order (runs of cells it must follow,
 * joined by the cheapest way between them) and the edges it comes in and leaves by (0 left, 1 top,
 * 2 right, 3 bottom): from the edge before one entrance through it (its trail the cheapest ground
 * there), on through the other to the edge before it; through either entrance alone and on to the
 * far edge (straight across most of the time); from one edge to another.
 */
function roadPlans(ground: Ground, ways: readonly WayOut[], rng: Rng): { legs: Vec[][]; sides: number[] }[] {
  const trails = ways.slice(0, 2).map((way) => ({ cells: [[edgeBeyond(ground, way).edge], [mouthCell(way)]], side: edgeBeyond(ground, way).side }));
  const across = (first: number): number => (rng() < 0.7 ? (first + 2) % 4 : (first + (rng() < 0.5 ? 1 : 3)) % 4);
  const plans: { legs: Vec[][]; sides: number[] }[] = [];
  const [a, b] = trails;
  if (a && b) plans.push({ legs: [...a.cells, ...[...b.cells].reverse()], sides: [a.side, b.side] });
  for (const trail of trails) {
    const far = across(trail.side);
    plans.push({ legs: [...trail.cells, [edgeCell(ground, far, rng)]], sides: [trail.side, far] });
  }
  // Edge to edge, a few ways, for a map whose entrances no road can be laid through.
  for (let k = 0; k < EDGE_PLANS; k++) {
    const first = Math.floor(rng() * 4);
    const second = across(first);
    plans.push({ legs: [[edgeCell(ground, first, rng)], [edgeCell(ground, second, rng)]], sides: [first, second] });
  }
  return plans;
}

/** The floor's cell just inside an entrance. */
function mouthCell({ mouth }: WayOut): Vec {
  return { x: Math.floor(mouth.at.x - mouth.out.x * 0.5), y: Math.floor(mouth.at.y - mouth.out.y * 0.5) };
}

/** The cells of a trail, from the floor's cell just inside its entrance out to where it fades. */
function trailCells(way: WayOut): Vec[] {
  const cells: Vec[] = [mouthCell(way)];
  for (let u = 0; u <= way.length; u += 0.25) {
    const p = wayPoint(way, u, wayCentre(way, u));
    const c = { x: Math.floor(p.x), y: Math.floor(p.y) };
    const last = cells[cells.length - 1]!;
    if (last.x !== c.x || last.y !== c.y) cells.push(c);
  }
  return cells;
}

/** Where a trail, followed on the way it leaves, meets the ground's edge, and which edge. */
function edgeBeyond({ bounds }: Pick<Ground, 'bounds'>, way: WayOut): { edge: Vec; side: number } {
  let p = way.mouth.at;
  for (let u = 0; u < way.length; u += 0.5) p = wayPoint(way, u, wayCentre(way, u));
  const { out } = way.mouth;
  // On beyond the trail's end the way it leaves, to the first edge it meets.
  const reach = Math.min(
    out.x > 0 ? (bounds.maxX - 0.5 - p.x) / out.x : out.x < 0 ? (bounds.minX + 0.5 - p.x) / out.x : Infinity,
    out.y > 0 ? (bounds.maxY - 0.5 - p.y) / out.y : out.y < 0 ? (bounds.minY + 0.5 - p.y) / out.y : Infinity,
  );
  const at = { x: p.x + out.x * Math.max(0, reach), y: p.y + out.y * Math.max(0, reach) };
  const edge = { x: Math.min(bounds.maxX - 1, Math.max(bounds.minX, Math.floor(at.x))), y: Math.min(bounds.maxY - 1, Math.max(bounds.minY, Math.floor(at.y))) };
  const side = edge.x === bounds.minX ? 0 : edge.y === bounds.minY ? 1 : edge.x === bounds.maxX - 1 ? 2 : 3;
  return { edge, side };
}

/** A cell on an edge of the ground, a fifth to four fifths along it. */
function edgeCell({ bounds }: Ground, side: number, rng: Rng): Vec {
  const t = 0.2 + rng() * 0.6;
  const x = Math.floor(bounds.minX + t * (bounds.maxX - bounds.minX));
  const y = Math.floor(bounds.minY + t * (bounds.maxY - bounds.minY));
  return side === 0 ? { x: bounds.minX, y } : side === 1 ? { x, y: bounds.minY } : side === 2 ? { x: bounds.maxX - 1, y } : { x, y: bounds.maxY - 1 };
}

/**
 * A road from the first of `ends` to the second, or, for a branch, from its one end to the road
 * `joins`; its crossings bridged, unless they would make more than `MOST_BRIDGES` on the map.
 */
function layRoad(ground: Ground, water: ForestWater, legs: readonly Vec[][], width: number, bridges: Bridged[], rng: Rng, joins?: readonly Vec[]): Vec[] | null {
  const field = waterField(water.rivers, water.lakes);
  for (let attempt = 0; attempt < (joins ? TRIES : 1); attempt++) {
    const cells = joins ? branchRoute(ground, legs, joins) : throughRoute(ground, legs);
    if (!cells) continue;
    const crossings = crossingsOf(cells, field);
    if (bridges.length + crossings.length > MOST_BRIDGES) continue;
    const placed = crossings.map((run) => bridgeFor(water.rivers, run, cells, width, field));
    if (placed.some((p) => p === null)) continue;
    // Never a bridge hard by another: a road that would cross back over the river it just crossed takes another way.
    const all = [...bridges, ...(placed as Bridged[])].map((b) => b.bridge.at);
    if (all.some((a, i) => all.slice(i + 1).some((b) => Math.hypot(a.x - b.x, a.y - b.y) < BRIDGES_APART))) continue;
    const line = roadLine(cells, placed as Bridged[], rng, field);
    // Its curves must keep out of the water everywhere but on its bridges.
    const onBridge = (p: Vec): boolean => (placed as Bridged[]).some(({ bridge }) => Math.hypot(p.x - bridge.at.x, p.y - bridge.at.y) <= bridge.length / 2 + 0.2);
    if (line.some((p) => field.distance(p.x, p.y) < 0 && !onBridge(p))) continue;
    if (hairpin(line)) continue;
    bridges.push(...(placed as Bridged[]));
    return line;
  }
  return null;
}

/**
 * Every leg in turn, each joined to the next by the cheapest way between them that keeps off the
 * ground already taken (a cell either side of it, but where the way sets out): a road never runs
 * into an entrance and back out the way it came, nor beside itself.
 */
function throughRoute(ground: Ground, legs: readonly Vec[][]): Vec[] | null {
  const { x0, y0, w, h } = ground.grid;
  const cost = Float32Array.from(ground.grid.cost);
  const take = (cells: readonly Vec[], from: Vec): void => {
    for (const c of cells) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = c.x + dx;
        const y = c.y + dy;
        if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h || Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) <= 2) continue;
        cost[(y - y0) * w + (x - x0)] = Infinity;
      }
    }
  };
  const cells: Vec[] = [...legs[0]!];
  for (const leg of legs.slice(1)) {
    const from = cells[cells.length - 1]!;
    const to = leg[0]!;
    take(cells, from);
    const way = cheapestRoute({ ...ground.grid, cost }, from, (x, y) => x === to.x && y === to.y, to);
    if (!way) return null;
    cells.push(...way.slice(1), ...leg.slice(1));
  }
  return cells;
}

/** A branch's way: through its legs, then the cheapest way on to the road it joins; long enough to be a road of its own. */
function branchRoute(ground: Ground, legs: readonly Vec[][], joins: readonly Vec[]): Vec[] | null {
  const leg = throughRoute(ground, legs);
  if (!leg) return null;
  const from = leg[leg.length - 1]!;
  const to = nearestOn(joins, from);
  const way = cheapestRoute(ground.grid, from, (x, y) => joins.some((p) => Math.abs(p.x - x - 0.5) < 1 && Math.abs(p.y - y - 0.5) < 1), to);
  const cells = way ? [...leg, ...way.slice(1)] : null;
  return cells && cells.length >= SHORTEST_BRANCH ? cells : null;
}

/** How far apart, in a road's points, two headings are compared, and how far a road may turn back over that stretch: no road doubles back on itself in a few cells (a road into an entrance and out again beside itself). */
const HAIRPIN_SPAN = 20;
const HAIRPIN_TURN = -0.35;

function hairpin(line: readonly Vec[]): boolean {
  const heading = (i: number): Vec => {
    const a = line[Math.max(0, i - 2)]!;
    const b = line[Math.min(line.length - 1, i + 2)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  };
  for (let i = 0; i + HAIRPIN_SPAN < line.length; i += 2) {
    const a = heading(i);
    const b = heading(i + HAIRPIN_SPAN);
    if (a.x * b.x + a.y * b.y < HAIRPIN_TURN) return true;
  }
  return false;
}

function nearestOn(line: readonly Vec[], p: Vec): Vec {
  let best = line[0]!;
  for (const q of line) if (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y)) best = q;
  return { x: Math.floor(best.x), y: Math.floor(best.y) };
}

/** The runs of a route's cells that lie in a river's water, as index ranges of the route. */
function crossingsOf(cells: readonly Vec[], field: { distance(x: number, y: number): number }): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  cells.forEach((c, i) => {
    const wet = field.distance(c.x + 0.5, c.y + 0.5) < WET;
    if (wet && start < 0) start = i;
    if (!wet && start >= 0) { runs.push([start, i - 1]); start = -1; }
  });
  return runs;
}

/** The bridge for a crossing: on the river the route crosses there, at its straightest point nearby where both ends and their approaches stand clear of the water, square to it, pointing the way the road goes. */
function bridgeFor(rivers: readonly DungeonRiver[], [a, b]: [number, number], cells: readonly Vec[], width: number, field: { distance(x: number, y: number): number }): Bridged | null {
  const mid = cells[(a + b) >> 1]!;
  const centre = { x: mid.x + 0.5, y: mid.y + 0.5 };
  let river = -1;
  let at = -1;
  let nearest = Infinity;
  rivers.forEach((r, k) => r.points.forEach((p, i) => {
    const d = Math.hypot(p.x - centre.x, p.y - centre.y);
    if (d < nearest) { nearest = d; river = k; at = i; }
  }));
  if (river < 0) return null;
  const { points, widths } = rivers[river]!;
  const bent = bends(points);
  const near = Array.from({ length: 13 }, (_, k) => at - 6 + k).filter((i) => i >= 0 && i < points.length).sort((p, q) => Math.abs(bent[p]!) - Math.abs(bent[q]!));
  const before = cells[Math.max(0, a - 2)]!;
  const after = cells[Math.min(cells.length - 1, b + 2)]!;
  for (const i of near) {
    let along = normalAt(points, i);
    if (along.x * (after.x - before.x) + along.y * (after.y - before.y) < 0) along = { x: -along.x, y: -along.y };
    const length = widths[i]! + 2 * BRIDGE_REACH;
    const p = points[i]!;
    // Its ends and the straight approaches beyond them on dry ground: a river looping back near the bridge would flood an approach.
    const dry = [-1, 1].every((side) => Array.from({ length: Math.ceil(APPROACH / 0.25) + 1 }, (_, k) => length / 2 + k * 0.25)
      .every((u) => field.distance(p.x + along.x * side * u, p.y + along.y * side * u) > 0.1));
    if (dry) return { river, bridge: { at: p, along, length, breadth: width + 0.15 } };
  }
  return null;
}

/**
 * The road's line: the route's cells smoothed into gentle curves, wandering a little, and straight
 * over each bridge and its approaches, so it meets the bridge square.
 */
function roadLine(cells: readonly Vec[], bridged: readonly Bridged[], rng: Rng, field: { distance(x: number, y: number): number }): Vec[] {
  const route = cells.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }));
  // Each bridge cuts the route: the route up to it, the straight way over it, the route from it.
  const fixed = bridged.map(({ bridge }) => {
    const reach = bridge.length / 2 + APPROACH;
    const start = { x: bridge.at.x - bridge.along.x * reach, y: bridge.at.y - bridge.along.y * reach };
    const end = { x: bridge.at.x + bridge.along.x * reach, y: bridge.at.y + bridge.along.y * reach };
    // The route gives way a couple of cells short of each approach, so the curve leads into it rather than doubling back.
    return { start, end, from: Math.max(0, nearestIndex(route, start) - LEAD_IN), to: Math.min(route.length - 1, nearestIndex(route, end) + LEAD_IN) };
  }).sort((a, b) => a.from - b.from);
  const noise = fractalNoise(rng, 2, 0.5, 9);
  // It never wanders towards water it passes near.
  const wander = (x: number, y: number): number => noise(x, y) * Math.max(0, Math.min(1, field.distance(x, y) - 1));
  const line: Vec[] = [];
  let from = 0;
  let begin = route[0]!;
  for (const piece of fixed) {
    line.push(...wandering(smooth([begin, ...route.slice(from + 1, Math.max(from + 1, piece.from)), piece.start]), wander));
    line.push(...straight(piece.start, piece.end));
    from = piece.to;
    begin = piece.end;
  }
  // On to the route's end, past the map's edge, however near it the last bridge stands.
  line.push(...wandering(smooth([begin, ...route.slice(Math.min(from + 1, route.length - 1))]), wander));
  return line;
}

function nearestIndex(line: readonly Vec[], p: Vec): number {
  let best = 0;
  line.forEach((q, i) => { if (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(line[best]!.x - p.x, line[best]!.y - p.y)) best = i; });
  return best;
}

/** A route's corners cut until it runs in curves (Chaikin, ends kept), every quarter cell. */
function smooth(points: readonly Vec[]): Vec[] {
  let line = points.filter((p, i) => i === 0 || i === points.length - 1 || i % 2 === 0);
  for (let round = 0; round < 4; round++) {
    const next: Vec[] = [line[0]!];
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i]!;
      const b = line[i + 1]!;
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(line[line.length - 1]!);
    line = next;
  }
  return everyQuarter(line);
}

/** Points about a quarter cell apart along a line. */
function everyQuarter(line: readonly Vec[]): Vec[] {
  const out: Vec[] = [line[0]!];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 0.25));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

function straight(a: Vec, b: Vec): Vec[] {
  return everyQuarter([a, b]).slice(1);
}

/** The line pushed a little either way of itself by slow noise, never at its ends, where it meets a bridge or the map's edge. */
function wandering(line: readonly Vec[], wander: (x: number, y: number) => number): Vec[] {
  return line.map((p, i) => {
    const hold = Math.min(1, i / 8, (line.length - 1 - i) / 8);
    const n = normalAt(line, i);
    const off = wander(p.x, p.y) * 2 * WANDER * hold;
    return { x: p.x + n.x * off, y: p.y + n.y * off };
  });
}

/** The cells a road's ground covers: within its half width and a verge of its line, inside the rooms' extent (so the map keeps its size). */
export function roadGround(floor: DungeonFloor, roads: readonly DungeonRoad[]): Vec[] {
  if (!roads.length) return [];
  const minX = Math.min(...floor.rooms.map((r) => r.x));
  const minY = Math.min(...floor.rooms.map((r) => r.y));
  const maxX = Math.max(...floor.rooms.map((r) => r.x + r.w));
  const maxY = Math.max(...floor.rooms.map((r) => r.y + r.h));
  const cells = new Map<string, Vec>();
  for (const road of roads) {
    const reach = road.width / 2 + 0.7;
    for (const p of road.points) {
      for (let y = Math.floor(p.y - reach); y <= Math.floor(p.y + reach); y++) {
        for (let x = Math.floor(p.x - reach); x <= Math.floor(p.x + reach); x++) {
          if (x < minX || y < minY || x >= maxX || y >= maxY) continue;
          if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) <= reach) cells.set(cellKey(x, y), { x, y });
        }
      }
    }
  }
  return [...cells.values()];
}

const roadFields = new WeakMap<readonly DungeonRoad[], LineField>();

/** How far a point lies from the roads' edges, in cells, negative on them; kept for the list, which the drawing asks a few million times. */
export function roadField(roads: readonly DungeonRoad[] | undefined): LineField {
  if (!roads?.length) return lineField([]);
  let field = roadFields.get(roads);
  if (!field) {
    const segments = roads.flatMap((road) => road.points.slice(1).flatMap((b, i) => {
      const a = road.points[i]!;
      return [a.x, a.y, b.x, b.y, road.width / 2];
    }));
    roadFields.set(roads, (field = lineField(segments)));
  }
  return field;
}
