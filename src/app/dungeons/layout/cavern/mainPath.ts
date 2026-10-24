/**
 * The main path of a cave floor, two cells wide: from where the floor is entered (the entrance,
 * or the stairwell from above) to where it is left (the stairwell down) or to the boss room. It
 * is found before the cave is shaped, as a walk of 2 × 2 blocks over the route's rooms, the cells
 * of its doors and the wall beside each, and the side walls of its tunnels, so every block it
 * takes can become floor.
 */

import { type StairSpot, approachCells, spotRect } from '../../floors/stairSpots';
import { cellKey, cellsOf, floorRect, inRect, wallRect } from '../../geometry';
import type { CellPoint, DungeonRoom } from '../../model';
import { hops, neighbours, openDoor } from '../../roomGraph';
import { CaveGrid, type CaveFloorPlan, ROCK, doorOwner } from './caveGrid';

export type LaneEnd = { kind: 'entrance' } | { kind: 'stair'; spot: StairSpot } | { kind: 'room'; id: number };

const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The entrance door's index, the first that leads in from outside and is no secret one. */
function entranceDoor(floor: Pick<CaveFloorPlan, 'doors'>): number {
  return floor.doors.findIndex((door) => door.from === null && door.kind !== 'secret');
}

function roomOfEnd(floor: Pick<CaveFloorPlan, 'rooms' | 'doors'>, end: LaneEnd): number {
  if (end.kind === 'room') return end.id;
  if (end.kind === 'entrance') return floor.doors[entranceDoor(floor)]?.to ?? -1;
  const r = spotRect(end.spot);
  return floor.rooms.find((room) => room.kind === 'room' && inRect(floorRect(room), r.x0, r.y0) && inRect(floorRect(room), r.x1, r.y1))?.id ?? -1;
}

/** The rooms from one end to the other by the fewest open doors; none where no way leads. */
export function mainRoute(floor: Pick<CaveFloorPlan, 'rooms' | 'doors'>, from: LaneEnd, to: LaneEnd): number[] {
  const start = roomOfEnd(floor, from);
  const goal = roomOfEnd(floor, to);
  if (start < 0 || goal < 0) return [];
  const adjacent = neighbours(floor.rooms.length, floor.doors, openDoor);
  const back = new Map<number, number>([[start, start]]);
  const queue = [start];
  for (let head = 0; head < queue.length && !back.has(goal); head++) {
    const at = queue[head]!;
    for (const next of adjacent[at] ?? []) {
      if (back.has(next)) continue;
      back.set(next, at);
      queue.push(next);
    }
  }
  if (!back.has(goal)) return [];
  const route = [goal];
  while (route[0] !== start) route.unshift(back.get(route[0]!)!);
  return route;
}

/** The cells a lane end's blocks must lie in, and of which they must hold one of `touch`. */
function endArea(floor: CaveFloorPlan, end: LaneEnd, side: 'upper' | 'lower'): { area: Set<string>; touch: Set<string> } {
  const keys = (cells: readonly CellPoint[]): Set<string> => new Set(cells.map((c) => cellKey(c.x, c.y)));
  if (end.kind === 'room') {
    const room = floor.rooms[end.id];
    const cells = room ? cellsOf(floorRect(room)) : [];
    return { area: keys(cells), touch: keys(cells) };
  }
  if (end.kind === 'stair') {
    const rows = approachCells(end.spot, side);
    return { area: keys([...cellsOf(spotRect(end.spot)), ...rows]), touch: keys(rows) };
  }
  const door = floor.doors[entranceDoor(floor)];
  if (!door) return { area: new Set(), touch: new Set() };
  const row = [-1, 0, 1].map((s) => ({ x: door.x + s * door.dir.y, y: door.y + s * door.dir.x }));
  return { area: keys([...row, ...row.map((c) => ({ x: c.x + door.dir.x, y: c.y + door.dir.y }))]), touch: keys([{ x: door.x, y: door.y }]) };
}

/** Which cells a lane block may hold. */
function laneCells(grid: CaveGrid, floor: CaveFloorPlan, route: readonly number[], ends: readonly Set<string>[]): (x: number, y: number) => boolean {
  const onRoute = new Set(route);
  const pairs = new Set(route.slice(1).map((id, k) => `${Math.min(id, route[k]!)}:${Math.max(id, route[k]!)}`));
  const laneDoors = new Set(
    floor.doors.flatMap((door, k) => {
      if (door.kind === 'secret') return [];
      if (door.from === null) return door.to === route[0] && k === entranceDoor(floor) ? [k] : [];
      return door.to !== null && pairs.has(`${Math.min(door.from, door.to)}:${Math.max(door.from, door.to)}`) ? [k] : [];
    }),
  );
  const stairCells = new Set(floor.stairs.flatMap((s) => cellsOf(spotRect(s))).map((c) => cellKey(c.x, c.y)));
  const tunnels = route.map((id) => floor.rooms[id]).filter((room): room is DungeonRoom => room !== undefined && room.kind !== 'room');
  const memo = new Map<string, boolean>();
  const allowed = (x: number, y: number): boolean => {
    const key = cellKey(x, y);
    if (stairCells.has(key) && !ends.some((end) => end.has(key))) return false;
    const envelope = grid.envelope(x, y);
    if (envelope !== ROCK) return onRoute.has(envelope);
    const owner = grid.owner(x, y);
    if (owner !== ROCK) return [...laneDoors].some((k) => owner === doorOwner(k));
    for (const k of laneDoors) {
      const door = floor.doors[k]!;
      if (Math.abs(x - door.x) + Math.abs(y - door.y) === 1 && (x - door.x) * door.dir.x + (y - door.y) * door.dir.y === 0) return grid.mayClaim(x, y, doorOwner(k));
    }
    return tunnels.some((room) => inRect(wallRect(room), x, y) && grid.mayClaim(x, y, room.id));
  };
  return (x, y) => {
    const key = cellKey(x, y);
    let ok = memo.get(key);
    if (ok === undefined) {
      ok = allowed(x, y);
      memo.set(key, ok);
    }
    return ok;
  };
}

const blockCells = (ax: number, ay: number): CellPoint[] => [
  { x: ax, y: ay },
  { x: ax + 1, y: ay },
  { x: ax, y: ay + 1 },
  { x: ax + 1, y: ay + 1 },
];

/** Blocks lying in the end's area and holding one of its touch cells. */
function endBlocks(end: { area: Set<string>; touch: Set<string> }, ok: (x: number, y: number) => boolean): string[] {
  const out = new Set<string>();
  for (const key of end.touch) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    for (const [ax, ay] of [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]] as const) {
      const cells = blockCells(ax, ay);
      if (cells.every((c) => end.area.has(cellKey(c.x, c.y)) && ok(c.x, c.y))) out.add(cellKey(ax, ay));
    }
  }
  return [...out];
}

/**
 * The lane's cells, two wide all the way, from `from` to `to` along `route`; null where no such
 * way fits. A stairwell is left from the row past its low end, the way down reached by the row before its high end.
 */
export function wideLane(grid: CaveGrid, floor: CaveFloorPlan, route: readonly number[], from: LaneEnd, to: LaneEnd): CellPoint[] | null {
  if (route.length === 0) return null;
  const start = endArea(floor, from, 'lower');
  const goal = endArea(floor, to, 'upper');
  const ok = laneCells(grid, floor, route, [start.area, goal.area]);
  const goals = new Set(endBlocks(goal, ok));
  const fits = (ax: number, ay: number): boolean => blockCells(ax, ay).every((c) => ok(c.x, c.y));
  const back = new Map<string, string>(endBlocks(start, ok).map((key) => [key, key]));
  const queue = [...back.keys()];
  let found: string | null = null;
  for (let head = 0; head < queue.length && found === null; head++) {
    const at = queue[head]!;
    if (goals.has(at)) found = at;
    const [ax, ay] = at.split(',').map(Number) as [number, number];
    for (const [dx, dy] of STEPS) {
      const key = cellKey(ax + dx, ay + dy);
      if (back.has(key) || !fits(ax + dx, ay + dy)) continue;
      back.set(key, at);
      queue.push(key);
    }
  }
  if (found === null) return null;
  const lane = new Map<string, CellPoint>();
  for (let key = found; ; key = back.get(key)!) {
    const [ax, ay] = key.split(',').map(Number) as [number, number];
    for (const c of blockCells(ax, ay)) lane.set(cellKey(c.x, c.y), c);
    if (back.get(key) === key) break;
  }
  return [...lane.values()].reverse();
}

/** Whether a two-cell lane fits from `from` to `to` on floor `index`: what a cave floor's layout must allow. */
export function laneFits(floor: CaveFloorPlan, from: LaneEnd, to: LaneEnd, index = -1): boolean {
  const route = mainRoute(floor, from, to);
  return route.length > 0 && wideLane(new CaveGrid(floor, index), floor, route, from, to) !== null;
}

/** Where a floor's main path ends without a way down: the boss room, else the normal room farthest by doors from where it starts. */
export function finalEnd(floor: Pick<CaveFloorPlan, 'rooms' | 'doors'>, from: LaneEnd, boss = true): LaneEnd {
  const bossRoom = boss ? floor.rooms.find((room) => room.boss) : undefined;
  if (bossRoom) return { kind: 'room', id: bossRoom.id };
  const distance = hops(neighbours(floor.rooms.length, floor.doors, openDoor), roomOfEnd(floor, from));
  const normal = floor.rooms.filter((room) => room.kind === 'room' && Number.isFinite(distance[room.id]));
  const far = normal.reduce<DungeonRoom | undefined>((best, room) => (!best || (distance[room.id] ?? 0) > (distance[best.id] ?? 0) ? room : best), undefined);
  return { kind: 'room', id: far?.id ?? 0 };
}

/** The first stairwell of a floor that leads to `to`: the way the main path takes. */
function firstStair(floor: Pick<CaveFloorPlan, 'stairs'>, to: number): StairSpot | undefined {
  return [...floor.stairs].filter((s) => s.to === to).sort((a, b) => (a.link ?? 0) - (b.link ?? 0))[0];
}

/** Where floor `index` of `count` is entered and left by its main path. */
export function laneEnds(index: number, count: number, floor: CaveFloorPlan, boss: boolean): [LaneEnd, LaneEnd] {
  const above = index > 0 ? firstStair(floor, index - 1) : undefined;
  const from: LaneEnd = above ? { kind: 'stair', spot: above } : { kind: 'entrance' };
  const below = index < count - 1 ? firstStair(floor, index + 1) : undefined;
  if (below) return [from, { kind: 'stair', spot: below }];
  return [from, finalEnd(floor, from, boss)];
}

/**
 * Whether a stairwell that would end on floor `index` (its upper end) keeps clear of the floor's
 * main path, which runs on to its first stairwell down: a second way between floors never takes
 * cells the first way needs.
 */
export function clearOfLane(floor: CaveFloorPlan, index: number): (spot: StairSpot) => boolean {
  const [from, to] = laneEnds(index, index + 2, floor, false);
  const route = mainRoute(floor, from, to);
  const lane = route.length ? wideLane(new CaveGrid(floor, index), floor, route, from, to) : null;
  if (!lane) return () => true;
  const keys = new Set(lane.map((c) => cellKey(c.x, c.y)));
  return (spot) => {
    const r = spotRect(spot);
    const home = floor.rooms.find((room) => inRect(floorRect(room), r.x0, r.y0));
    const kept = [...cellsOf(r), ...approachCells(spot, 'upper'), ...approachCells(spot, 'lower')];
    // Its cells may not be lane, nor lie beside lane outside its own room, which a tunnel would then touch.
    return !kept.some((c) => {
      if (keys.has(cellKey(c.x, c.y))) return true;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const n = { x: c.x + dx, y: c.y + dy };
          if (keys.has(cellKey(n.x, n.y)) && !(home && inRect(floorRect(home), n.x, n.y))) return true;
        }
      }
      return false;
    });
  };
}
