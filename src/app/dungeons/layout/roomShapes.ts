/**
 * Round rooms and colonnades, decided per mirror group so twins stay alike. A room can be round
 * only when it is square and every door sits in the middle of a wall, and never around a landing.
 */

import type { DungeonParams } from '../params';
import { type KeyedRng, type Rng, chance } from '../rng';
import { type WorkLayout, type WorkRoom, doorsOf, isNormal, liveRooms, toLocal } from './workLayout';

function mirrorGroups(layout: WorkLayout): WorkRoom[][] {
  const groups = new Map<number, WorkRoom[]>();
  for (const room of liveRooms(layout).filter(isNormal)) groups.set(room.group, [...(groups.get(room.group) ?? []), room]);
  return [...groups.values()];
}

function doorsInMiddles(layout: WorkLayout, room: WorkRoom): boolean {
  const middle = (room.depth - 1) / 2;
  const half = (room.width - 1) / 2;
  return doorsOf(layout, room.id).every((door) => {
    const { i, j } = toLocal(room, door);
    return (j === 0 && (i === 0 || i === room.depth - 1)) || (i === middle && Math.abs(j) === half);
  });
}

function mayBeRound(layout: WorkLayout, room: WorkRoom): boolean {
  return !room.fixed && room.width === room.depth && room.width >= 5 && doorsInMiddles(layout, room);
}

function roundChance(layout: WorkLayout, members: WorkRoom[], params: DungeonParams): number {
  const first = members[0];
  if (!first) return 0;
  const doors = members.reduce((sum, room) => sum + doorsOf(layout, room.id).length, 0) / members.length;
  return (doors / 3) * ((first.width - 2) / first.width) * params.rotundaFactor;
}

/** Longer and deeper rooms take colonnades more often; the first room is a likely hall. */
function colonnadeChance(members: WorkRoom[], params: DungeonParams): number {
  const first = members[0];
  if (!first) return 0;
  const w = first.width;
  const d = first.depth;
  let p = (0.7 * (d - 4)) / d + (0.3 * (w - 4)) / w;
  if (w === 5) p /= 2;
  if (w !== d) p *= Math.max(0, 1.2 - w / d);
  p *= params.colonnadeFactor;
  if (members.some((room) => room.id === 0)) p += 0.5;
  return p;
}

function canHoldColumns(room: WorkRoom): boolean {
  return room.rotunda ? room.width >= 7 : room.width >= 5;
}

function shapeGroup(rng: Rng, layout: WorkLayout, members: WorkRoom[], params: DungeonParams): void {
  const round = members.every((room) => mayBeRound(layout, room)) && chance(rng, roundChance(layout, members, params));
  members.forEach((room) => (room.rotunda = round));
  const columns = chance(rng, colonnadeChance(members, params));
  members.forEach((room) => (room.colonnade = columns && canHoldColumns(room)));
}

export function shapeRooms(rngOf: KeyedRng, layout: WorkLayout, params: DungeonParams): void {
  // A cave's rooms are shaped by the cave (`layout/cavern/`): never round, never colonnaded.
  if (params.cave) return;
  const rng = rngOf('shapes');
  mirrorGroups(layout).forEach((members) => shapeGroup(rng, layout, members, params));
}
