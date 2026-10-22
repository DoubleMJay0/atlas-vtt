/**
 * Life for rooms nobody wrote about: now and then a fountain or a well, crates or barrels in a
 * corner, a tapestry on the back wall.
 */

import type { DungeonDoor, DungeonProp, PropKind } from '../model';
import type { DungeonParams } from '../params';
import { type Rng, chance, int, shuffled } from '../rng';
import { type RoomFrame, backWallOpen, facingIn, onFloor, pointIn } from './roomFrame';

/** Shared across the dungeon: each fountain halves the next one's chance; one well at most. */
export interface RandomPropState {
  fountainChance: number;
  wellPlaced: boolean;
}

function at(frame: RoomFrame, kind: PropKind, u: number, v: number, rotation: number): DungeonProp {
  const p = pointIn(frame, u, v);
  return { kind, x: p.x, y: p.y, rotation, scale: 1, room: frame.room.id };
}

function centrepiece(rng: Rng, frame: RoomFrame, params: DungeonParams, state: RandomPropState): DungeonProp | null {
  if (!onFloor(frame, frame.centre, 0.9)) return null;
  if (chance(rng, state.fountainChance)) {
    state.fountainChance /= 2;
    return at(frame, 'fountain', 0, 0, 0);
  }
  const well = params.wellChance * (frame.room.rotunda ? 2 : 1);
  if (!state.wellPlaced && chance(rng, well)) {
    state.wellPlaced = true;
    return at(frame, 'well', 0, 0, 0);
  }
  return null;
}

/** A floor corner with no door beside it, given as the corner cell's centre in room coordinates. */
function freeCorner(rng: Rng, frame: RoomFrame, doors: readonly DungeonDoor[]): [number, number, number, number] | null {
  const corners: [number, number, number, number][] = [
    [-1, -1, 1, 1],
    [-1, 1, 1, -1],
    [1, -1, -1, 1],
    [1, 1, -1, -1],
  ].map(([su, sv, iu, iv]) => [(su ?? 0) * (frame.halfDepth - 0.5), (sv ?? 0) * (frame.halfWidth - 0.5), iu ?? 0, iv ?? 0]);
  const nearDoor = (u: number, v: number): boolean => {
    const p = pointIn(frame, u, v);
    return doors.some((d) => Math.abs(d.x + 0.5 - p.x) + Math.abs(d.y + 0.5 - p.y) <= 1.01);
  };
  return shuffled(rng, corners).find(([u, v]) => onFloor(frame, pointIn(frame, u, v), 0.3) && !nearDoor(u, v)) ?? null;
}

function storage(rng: Rng, frame: RoomFrame, doors: readonly DungeonDoor[]): DungeonProp[] {
  const corner = freeCorner(rng, frame, doors);
  if (!corner) return [];
  const [u, v, iu, iv] = corner;
  const tilt = (): number => (rng() - 0.5) * 0.4;
  if (chance(rng, 2 / 3)) {
    const spots: [number, number][] = [[0, 0], [iu, 0], [0, iv]];
    return spots.slice(0, int(rng, 1, 3)).map(([du, dv]) => at(frame, 'crate', u + du * 0.75, v + dv * 0.75, tilt()));
  }
  const spots: [number, number][] = [[0, 0], [iu, 0], [0, iv], [iu, iv]];
  return spots.slice(0, int(rng, 1, 4)).map(([du, dv]) => at(frame, 'barrel', u + du * 0.55, v + dv * 0.55, tilt()));
}

export function randomProps(rng: Rng, frame: RoomFrame, doors: readonly DungeonDoor[], params: DungeonParams, state: RandomPropState): DungeonProp[] {
  const out: DungeonProp[] = [];
  const centre = centrepiece(rng, frame, params, state);
  if (centre) out.push(centre);
  if (chance(rng, 1 / 3)) out.push(...storage(rng, frame, doors));
  const tapestry = params.tapestryChance / (frame.halfWidth * 2);
  if (!backWallOpen(frame, doors) && chance(rng, tapestry)) out.push(at(frame, 'tapestry', frame.halfDepth - 0.1, 0, facingIn(frame)));
  return out;
}
