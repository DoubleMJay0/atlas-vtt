/**
 * Which cells the main path may take on a cave floor and whose each becomes: a room's own cells
 * (its rectangle), a narrows' (its door cell and the wall cell beside it), or a tunnel's (its side
 * walls, where no other room's rectangle is near).
 */

import { type StairSpot, spotRect } from '../../floors/stairSpots';
import { cellKey, cellsOf, inRect, wallRect } from '../../geometry';
import type { CellPoint, DungeonRoom } from '../../model';
import { type CaveFloorPlan, type CaveGrid, ROCK, doorOwner } from './caveGrid';

/** The entrance door's index, the first that leads in from outside and is no secret one. */
export function entranceDoor(floor: Pick<CaveFloorPlan, 'doors'>): number {
  return floor.doors.findIndex((door) => door.from === null && door.kind !== 'secret');
}

/** The doors a lane passes: between rooms one after the other on the route, and the entrance into its first. */
function laneDoorsOf(floor: Pick<CaveFloorPlan, 'doors'>, route: readonly number[]): number[] {
  const pairs = new Set(route.slice(1).map((id, k) => `${Math.min(id, route[k]!)}:${Math.max(id, route[k]!)}`));
  return floor.doors.flatMap((door, k) => {
    if (door.kind === 'secret') return [];
    if (door.from === null) return door.to === route[0] && k === entranceDoor(floor) ? [k] : [];
    return door.to !== null && pairs.has(`${Math.min(door.from, door.to)}:${Math.max(door.from, door.to)}`) ? [k] : [];
  });
}

/** The lane door the cell stands beside, in the wall it is set in, if one does. */
function besideDoor(floor: Pick<CaveFloorPlan, 'doors'>, doors: readonly number[], x: number, y: number): number | undefined {
  return doors.find((k) => {
    const door = floor.doors[k]!;
    return Math.abs(x - door.x) + Math.abs(y - door.y) === 1 && (x - door.x) * door.dir.x + (y - door.y) * door.dir.y === 0;
  });
}

/** Whose a lane cell would be, or null where the lane may not go: off the route, on a stairwell other than `ends`', or `banned`. */
export type LaneOwner = (x: number, y: number) => number | null;

export function laneOwners(grid: CaveGrid, floor: CaveFloorPlan, route: readonly number[], ends: readonly ReadonlySet<string>[], banned: ReadonlySet<string> = new Set()): LaneOwner {
  const onRoute = new Set(route);
  const laneDoors = laneDoorsOf(floor, route);
  const stairCells = new Set(floor.stairs.flatMap((s: StairSpot) => cellsOf(spotRect(s))).map((c) => cellKey(c.x, c.y)));
  const tunnels = route.map((id) => floor.rooms[id]).filter((room): room is DungeonRoom => room !== undefined && room.kind !== 'room');
  const memo = new Map<string, number | null>();
  const ownerOf = (x: number, y: number, key: string): number | null => {
    if (banned.has(key) || (stairCells.has(key) && !ends.some((end) => end.has(key)))) return null;
    const envelope = grid.envelope(x, y);
    if (envelope !== ROCK) return onRoute.has(envelope) ? envelope : null;
    const owner = grid.owner(x, y);
    if (owner !== ROCK) return laneDoors.some((k) => owner === doorOwner(k)) ? owner : null;
    const beside = besideDoor(floor, laneDoors, x, y);
    if (beside !== undefined) return grid.mayWiden(x, y, doorOwner(beside)) ? doorOwner(beside) : null;
    return tunnels.find((room) => inRect(wallRect(room), x, y) && grid.mayWiden(x, y, room.id))?.id ?? null;
  };
  return (x, y) => {
    const key = cellKey(x, y);
    let owner = memo.get(key);
    if (owner === undefined) {
      owner = ownerOf(x, y, key);
      memo.set(key, owner);
    }
    return owner;
  };
}

/** A lane cell whose owner may not touch a neighbour's (both lane cells, or one already shaped), which may be given up, or null. */
export function laneConflict(grid: CaveGrid, lane: readonly CellPoint[], owners: LaneOwner): string | null {
  const own = new Map(lane.map((c) => [cellKey(c.x, c.y), owners(c.x, c.y) ?? ROCK] as const));
  const ownerAt = (x: number, y: number): number => own.get(cellKey(x, y)) ?? grid.owner(x, y);
  const spare = (c: CellPoint): boolean => grid.envelope(c.x, c.y) === ROCK && grid.owner(c.x, c.y) === ROCK;
  for (const c of lane) {
    const owner = ownerAt(c.x, c.y);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const n = { x: c.x + dx, y: c.y + dy };
        if (grid.mayTouchAt(owner, ownerAt(n.x, n.y), c.x, c.y, n.x, n.y, ownerAt)) continue;
        const nIsLane = own.has(cellKey(n.x, n.y));
        return cellKey(...(spare(c) || !nIsLane || !spare(n) ? ([c.x, c.y] as const) : ([n.x, n.y] as const)));
      }
    }
  }
  return null;
}

/** Gives every lane cell its owner for good, as `laneOwners` read them before anything was claimed. */
export function claimLane(grid: CaveGrid, floor: CaveFloorPlan, route: readonly number[], lane: readonly CellPoint[]): void {
  const keys = new Set(lane.map((c) => cellKey(c.x, c.y)));
  const owners = laneOwners(grid, floor, route, [keys]);
  const given = lane.map((c) => [c, owners(c.x, c.y)] as const);
  for (const [c, owner] of given) if (owner !== null) grid.require(owner, [c]);
}
