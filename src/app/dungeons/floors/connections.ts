/**
 * The stairwells between two floors. The first leads down from a room of the upper floor far from
 * where that floor is entered, and the floor below grows around its landing. Where both floors
 * have six rooms or more, a second joins rooms that lie over each other, as far from the first as
 * both floors' rooms allow, so a party has two ways between them.
 */

import type { DungeonDoor, DungeonRoom } from '../model';
import { floorRect, intersection } from '../geometry';
import { type Rng, pick, weighted } from '../rng';
import { hops, neighbours } from '../roomGraph';
import { type FloorSpace, type StairEnd, type StairSpot, spotFits, spotRect, spotsWithin } from './stairSpots';

/** Two ways between floors from this many normal rooms on each. */
export const TWO_CONNECTIONS_FROM = 6;
/** A second stairwell's rooms lie at least this many doors from the first's, on both floors. */
export const MIN_CONNECTION_SPREAD = 2;

export interface FloorShape {
  rooms: readonly DungeonRoom[];
  doors: readonly DungeonDoor[];
  stairs: readonly (StairSpot & { to: number })[];
}

export interface PlacedStair {
  room: number;
  spot: StairSpot;
}

function endOf(stair: { to: number }, index: number): StairEnd {
  return stair.to > index ? 'upper' : 'lower';
}

export function spaceOf(floor: FloorShape, index: number): FloorSpace {
  return { doors: floor.doors, stairs: floor.stairs, ends: floor.stairs.map((stair) => endOf(stair, index)) };
}

export function normalRooms(floor: Pick<FloorShape, 'rooms'>): number {
  return floor.rooms.filter((room) => room.kind === 'room').length;
}

/** The rooms that hold a stairwell end, and room 0 (where the floor is entered). */
function anchors(floor: FloorShape): number[] {
  const holders = floor.stairs.map((stair) => floor.rooms.find((room) => room.kind === 'room' && rectHolds(room, stair))?.id ?? 0);
  return [0, ...holders];
}

function rectHolds(room: DungeonRoom, spot: StairSpot): boolean {
  const f = floorRect(room);
  const r = spotRect(spot);
  return r.x0 >= f.x0 && r.x1 <= f.x1 && r.y0 >= f.y0 && r.y1 <= f.y1;
}

/** Doors walked from the nearest of `from` to every room. */
function distanceFrom(floor: FloorShape, from: readonly number[]): number[] {
  const adjacent = neighbours(floor.rooms.length, floor.doors);
  const each = from.map((id) => hops(adjacent, id));
  return floor.rooms.map((room) => Math.min(...each.map((d) => d[room.id] ?? Infinity)));
}

function holdsStairs(room: DungeonRoom): boolean {
  return room.kind === 'room' && !room.rotunda && !room.boss && room.wing === 'regular';
}

/** Where the first stairwell down from floor `index` stands: a room the farther from its entry and other stairs, the likelier. */
export function chooseDescent(rng: Rng, floor: FloorShape, index: number, across = 1): PlacedStair | null {
  const space = spaceOf(floor, index);
  const distance = distanceFrom(floor, anchors(floor));
  let options = floor.rooms.filter(holdsStairs).map((room) => [room, ((distance[room.id] ?? 0) + 1) ** 2] as const);
  while (options.length > 0) {
    const room = weighted(rng, options);
    const spots = spotsWithin(floorRect(room), across).filter((spot) => spotFits(room, space, spot, 'upper'));
    if (spots.length > 0) return { room: room.id, spot: pick(rng, spots) };
    options = options.filter(([other]) => other !== room);
  }
  return null;
}

/** Rooms of the upper and lower floor that lie over each other, the pairs farthest from the stairs already there first. */
function overlappingPairs(upper: FloorShape, lower: FloorShape): { a: DungeonRoom; b: DungeonRoom; spread: number }[] {
  const upperFar = distanceFrom(upper, anchors(upper));
  const lowerFar = distanceFrom(lower, anchors(lower));
  const pairs: { a: DungeonRoom; b: DungeonRoom; spread: number }[] = [];
  for (const a of upper.rooms.filter(holdsStairs)) {
    for (const b of lower.rooms.filter(holdsStairs)) {
      const spread = Math.min(upperFar[a.id] ?? 0, lowerFar[b.id] ?? 0);
      if (spread >= MIN_CONNECTION_SPREAD && intersection(floorRect(a), floorRect(b))) pairs.push({ a, b, spread });
    }
  }
  return pairs.sort((x, y) => y.spread - x.spread);
}

/**
 * A further stairwell between `upper` (floor `index`) and `lower` (floor `index + 1`): rooms that
 * lie over each other and hold the same rectangle on both, as far from the stairs between them
 * already as both floors allow (at least `MIN_CONNECTION_SPREAD` doors); null where none can stand.
 */
export function extraConnection(rng: Rng, upper: FloorShape, lower: FloorShape, index: number, allowed: (spot: StairSpot) => boolean = () => true): StairSpot | null {
  const upperSpace = spaceOf(upper, index);
  const lowerSpace = spaceOf(lower, index + 1);
  const spots: StairSpot[] = [];
  let widest = 0;
  for (const { a, b, spread } of overlappingPairs(upper, lower)) {
    if (spots.length > 0 && spread < widest * 0.75) break;
    const shared = intersection(floorRect(a), floorRect(b));
    const fitting = shared ? spotsWithin(shared).filter((spot) => spotFits(a, upperSpace, spot, 'upper') && spotFits(b, lowerSpace, spot, 'lower') && allowed(spot)) : [];
    if (fitting.length === 0) continue;
    if (spots.length === 0) widest = spread;
    spots.push(...fitting);
  }
  return spots.length > 0 ? pick(rng, spots) : null;
}
