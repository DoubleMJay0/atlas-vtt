/**
 * What a room is, read from the architecture alone: its size and shape, its place among the doors
 * (a dead end, a hub, the largest hall, the deepest room, the boss room), and whether a stairwell
 * stands in it.
 * Furniture follows from it; nothing here implies treasure or a fight.
 */

import type { DungeonDoor, DungeonRoom, DungeonStair } from '../model';
import { cellsOf, holdsCell } from '../geometry';
import { type Rng, weighted } from '../rng';
import { hops, neighbours } from '../roomGraph';

export type RoomRole = 'boss' | 'hall' | 'deepest' | 'stairs' | 'hub' | 'dead-end' | 'plain';

/** The largest hall must have at least this much floor. */
const HALL_AREA = 12;
/** The deepest room is furnished as such from this much floor. */
const DEEPEST_AREA = 6;
/** The share of normal rooms left empty lies between these. */
const EMPTY_SHARE: readonly [number, number] = [0.24, 0.36];
/** How readily a room of each role is the one left empty. */
const EMPTY_WEIGHT: Readonly<Record<RoomRole, number>> = { boss: 0, hall: 0, deepest: 1, stairs: 3, hub: 1, 'dead-end': 2, plain: 3 };
/** Rooms this small are hard to furnish, so they are left empty first. */
const TINY_AREA = 4;

export interface RoomRoles {
  roles: Map<number, RoomRole>;
  /** Normal rooms left without props. */
  empty: Set<number>;
}

/** A room's floor in cells: its cave cells where it has them, else its rectangle. */
export function roomArea(room: Pick<DungeonRoom, 'w' | 'h' | 'cells'>): number {
  return room.cells?.length ?? room.w * room.h;
}

const area = roomArea;

/** Whether a stairwell lies in the room's floor. */
export function holdsStairs(room: Pick<DungeonRoom, 'x' | 'y' | 'w' | 'h' | 'cells'>, stairs: readonly Pick<DungeonStair, 'x' | 'y' | 'w' | 'h'>[]): boolean {
  return stairs.some((s) => cellsOf({ x0: s.x, y0: s.y, x1: s.x + s.w - 1, y1: s.y + s.h - 1 }).every((c) => holdsCell(room, c.x, c.y)));
}

function roleOf(room: DungeonRoom, doors: number, stairs: readonly DungeonStair[]): RoomRole {
  if (holdsStairs(room, stairs)) return 'stairs';
  if (doors >= 4 || (doors >= 3 && area(room) >= HALL_AREA)) return 'hub';
  return doors <= 1 ? 'dead-end' : 'plain';
}

/** The roles of a floor's normal rooms, and which of them stand empty (about a third). */
export function roomRoles(rng: Rng, floor: { rooms: readonly DungeonRoom[]; doors: readonly DungeonDoor[]; stairs: readonly DungeonStair[] }): RoomRoles {
  const normal = floor.rooms.filter((room) => room.kind === 'room');
  const doorCount = (id: number): number => floor.doors.filter((door: DungeonDoor) => door.from === id || door.to === id).length;
  const distance = hops(neighbours(floor.rooms.length, floor.doors), 0);
  const roles = new Map(normal.map((room) => [room.id, roleOf(room, doorCount(room.id), floor.stairs)] as const));
  const largest = [...normal].sort((a, b) => area(b) - area(a) || (distance[b.id] ?? 0) - (distance[a.id] ?? 0))[0];
  if (largest && area(largest) >= HALL_AREA) roles.set(largest.id, 'hall');
  const deep = normal.reduce<DungeonRoom | undefined>((best, room) => (!best || (distance[room.id] ?? -1) > (distance[best.id] ?? -1) ? room : best), undefined);
  const deepRole = deep && roles.get(deep.id);
  if (deep && deepRole !== 'hall' && deepRole !== 'stairs' && area(deep) >= DEEPEST_AREA) roles.set(deep.id, 'deepest');
  for (const room of normal) if (room.boss) roles.set(room.id, 'boss');
  return { roles, empty: emptyRooms(rng, normal, roles) };
}

function emptyRooms(rng: Rng, normal: readonly DungeonRoom[], roles: ReadonlyMap<number, RoomRole>): Set<number> {
  const share = EMPTY_SHARE[0] + rng() * (EMPTY_SHARE[1] - EMPTY_SHARE[0]);
  let pool = normal.map((room) => [room.id, EMPTY_WEIGHT[roles.get(room.id) ?? 'plain'] * (area(room) <= TINY_AREA ? 3 : 1)] as const).filter(([, w]) => w > 0);
  const empty = new Set<number>();
  for (let wanted = Math.round(normal.length * share); empty.size < wanted && pool.length > 0; ) {
    const id = weighted(rng, pool);
    empty.add(id);
    pool = pool.filter(([other]) => other !== id);
  }
  return empty;
}
