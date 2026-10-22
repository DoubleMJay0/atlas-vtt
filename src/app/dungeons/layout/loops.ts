/**
 * Loops: extra doors between rooms that share a long enough wall, wherever they cut a long way
 * short. A loop never opens a way past the gate or into a secret wing: such a door is barred or
 * barricaded (one of the two per dungeon), and in a string every loop is.
 */

import type { CellDir, CellPoint, DoorKind } from '../model';
import type { DungeonParams } from '../params';
import { type CellRect, inRect, intersection, rectsTouch } from '../geometry';
import { type Rng, chance, pick, stream } from '../rng';
import { layoutEdges } from './costs';
import { pathCosts } from './graph';
import { drawDoorKind } from './sizes';
import { GATED_ZONE, type WorkLayout, type WorkRoom, floorOf, isNormal, liveRooms, roomRect } from './workLayout';

/** Loops only shorten ways longer than this. */
const MIN_LOOP_COST = 5;

interface LoopSpot {
  cell: CellPoint;
  /** From room `a` into room `b`. */
  dir: CellDir;
}

interface RankedCandidate {
  candidate: LoopCandidate;
  /** No less than the current cost between its rooms. */
  cost: number;
}

interface LoopCandidate {
  a: number;
  b: number;
  spots: LoopSpot[];
  passable: boolean;
}

function spotsAlong(a: WorkRoom, b: WorkRoom, cells: CellPoint[], d: CellDir): LoopSpot[] {
  const fa = floorOf(a);
  const fb = floorOf(b);
  return cells
    .filter((c) => inRect(fa, c.x - d.x, c.y - d.y) && inRect(fb, c.x + d.x, c.y + d.y))
    .map((cell) => ({ cell, dir: d }));
}

/** Door cells in the straight wall two rooms share (never its corners); none for a wall under 3 cells. */
function sharedWallSpots(a: WorkRoom, b: WorkRoom): LoopSpot[] {
  const wall = intersection(roomRect(a), roomRect(b));
  if (!wall) return [];
  const cells: CellPoint[] = [];
  for (let y = wall.y0; y <= wall.y1; y++) for (let x = wall.x0; x <= wall.x1; x++) cells.push({ x, y });
  let spots: LoopSpot[] = [];
  if (wall.x0 === wall.x1) {
    spots = spotsAlong(a, b, cells, { x: 1, y: 0 });
    if (spots.length === 0) spots = spotsAlong(a, b, cells, { x: -1, y: 0 });
  } else if (wall.y0 === wall.y1) {
    spots = spotsAlong(a, b, cells, { x: 0, y: 1 });
    if (spots.length === 0) spots = spotsAlong(a, b, cells, { x: 0, y: -1 });
  }
  const length = Math.max(wall.x1 - wall.x0, wall.y1 - wall.y0) + 1;
  return length >= 3 ? spots : [];
}

function isSecretZone(zone: number): boolean {
  return zone > GATED_ZONE;
}

function candidatesOf(layout: WorkLayout, params: DungeonParams): LoopCandidate[] {
  const linked = new Set(layout.doors.map((d) => `${Math.min(d.from ?? -1, d.to ?? -1)}:${Math.max(d.from ?? -1, d.to ?? -1)}`));
  const doorCells = new Set(layout.doors.map((d) => `${d.x},${d.y}`));
  const nearDoor = (c: CellPoint): boolean =>
    [0, 1, -1].some((dx) => [0, 1, -1].some((dy) => Math.abs(dx) + Math.abs(dy) <= 1 && doorCells.has(`${c.x + dx},${c.y + dy}`)));
  const rooms = liveRooms(layout);
  const rects = rooms.map(roomRect);
  const out: LoopCandidate[] = [];
  rooms.forEach((a, k) => {
    for (let m = k + 1; m < rooms.length; m++) {
      const b = rooms[m] as WorkRoom;
      if (!rectsTouch(rects[k] as CellRect, rects[m] as CellRect)) continue;
      if (a.zone !== b.zone && (isSecretZone(a.zone) || isSecretZone(b.zone))) continue;
      if (linked.has(`${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`)) continue;
      const spots = sharedWallSpots(a, b).filter((spot) => !nearDoor(spot.cell));
      if (spots.length > 0) out.push({ a: a.id, b: b.id, spots, passable: a.zone === b.zone && !params.string });
    }
  });
  return out;
}

function costBetween(layout: WorkLayout, candidate: LoopCandidate): number {
  return pathCosts(layoutEdges(layout), candidate.a)[candidate.b] ?? Infinity;
}

/**
 * The candidate whose rooms lie farthest apart. Doors only ever shorten ways, so a cost worked
 * out earlier is an upper bound: only the leader's cost is worked out again, until it stays ahead.
 */
function longestWay(layout: WorkLayout, ranked: RankedCandidate[]): LoopCandidate | null {
  for (;;) {
    const top = ranked[0];
    if (!top) return null;
    const cost = costBetween(layout, top.candidate);
    if (!Number.isFinite(cost) || cost <= MIN_LOOP_COST) {
      ranked.shift();
      continue;
    }
    const next = ranked[1];
    if (!next || cost >= next.cost) {
      ranked.shift();
      return top.candidate;
    }
    top.cost = cost;
    ranked.sort((x, y) => y.cost - x.cost);
  }
}

function loopDoorKind(rng: Rng, layout: WorkLayout, candidate: LoopCandidate, impassable: DoorKind): DoorKind {
  if (!candidate.passable) return impassable;
  const a = layout.rooms[candidate.a];
  const b = layout.rooms[candidate.b];
  return drawDoorKind(rng, !!a && !!b && !isNormal(a) && !isNormal(b));
}

function withoutSpotsNear(ranked: RankedCandidate[], cell: CellPoint): RankedCandidate[] {
  return ranked
    .map((r) => ({ ...r, candidate: { ...r.candidate, spots: r.candidate.spots.filter((s) => Math.abs(s.cell.x - cell.x) + Math.abs(s.cell.y - cell.y) > 1) } }))
    .filter((r) => r.candidate.spots.length > 0);
}

export function addLoops(seed: number, layout: WorkLayout, params: DungeonParams): void {
  const rng = stream(seed, 'layout', 'loops');
  const impassable: DoorKind = chance(rng, 0.5) ? 'portcullis' : 'barricade';
  const edges = layoutEdges(layout);
  const costs = new Map<number, number[]>();
  const costFrom = (a: number): number[] => costs.get(a) ?? costs.set(a, pathCosts(edges, a)).get(a) ?? [];
  let ranked = candidatesOf(layout, params)
    .map((candidate) => ({ candidate, cost: costFrom(candidate.a)[candidate.b] ?? Infinity }))
    .filter((r) => Number.isFinite(r.cost) && r.cost > MIN_LOOP_COST)
    .sort((x, y) => y.cost - x.cost);
  for (;;) {
    const chosen = longestWay(layout, ranked);
    if (!chosen) return;
    const spot = pick(rng, chosen.spots);
    const kind = loopDoorKind(rng, layout, chosen, impassable);
    layout.doors.push({ x: spot.cell.x, y: spot.cell.y, dir: spot.dir, kind, from: chosen.a, to: chosen.b, loop: true });
    ranked = withoutSpotsNear(ranked, spot.cell);
  }
}
