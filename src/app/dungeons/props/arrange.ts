/**
 * Where furniture stands in a room: in its middle, before its back wall, on a dais against it, on
 * the wall itself, in a free corner, or in a row down its length. Each placement is tried against
 * the room's free floor (`RoomSpace`) and takes what it uses; a placement that finds no room adds nothing.
 */

import type { CellPoint, DungeonDoor, DungeonProp, PropKind } from '../model';
import { type Rng, int, shuffled } from '../rng';
import { backWallOpen, facingIn, pointIn } from './roomFrame';
import { PROP_REACH, type RoomSpace, isFree, take } from './space';

/** Across-the-room slots, middle first. */
const SLOTS = [0, -1, 1, -2, 2, -3, 3];

function propAt(space: RoomSpace, kind: PropKind, p: CellPoint, rotation: number, scale = 1): DungeonProp {
  return { kind, x: p.x, y: p.y, rotation, scale, room: space.frame.room.id };
}

/** One prop at `p` if it is free there. */
function tryPlace(space: RoomSpace, kind: PropKind, p: CellPoint, rotation: number): DungeonProp[] {
  const reach = PROP_REACH[kind];
  if (!isFree(space, p, reach)) return [];
  take(space, p, reach);
  return [propAt(space, kind, p, rotation)];
}

/** A fountain, well or statue in the room's middle. */
export function centrepiece(space: RoomSpace, kind: PropKind): DungeonProp[] {
  return tryPlace(space, kind, space.frame.centre, 0);
}

/** Props side by side in the aisle before the back wall, the middle first, facing into the room. */
export function beforeBackWall(space: RoomSpace, doors: readonly DungeonDoor[], kinds: readonly PropKind[]): DungeonProp[] {
  const { frame } = space;
  if (backWallOpen(frame, doors)) return [];
  const out: DungeonProp[] = [];
  let slots = SLOTS;
  for (const kind of kinds) {
    const u = frame.halfDepth - Math.max(0.5, PROP_REACH[kind] + 0.1);
    const v = slots.find((slot) => isFree(space, pointIn(frame, u, slot), PROP_REACH[kind]));
    if (v === undefined) continue;
    out.push(...tryPlace(space, kind, pointIn(frame, u, v), facingIn(frame)));
    slots = slots.filter((slot) => slot !== v);
  }
  return out;
}

/**
 * A dais against the back wall, facing the way in, with `item` on it. Never free in a room: a
 * round room or a back wall a door breaks has none.
 */
export function dais(space: RoomSpace, doors: readonly DungeonDoor[], item: PropKind): DungeonProp[] {
  const { frame } = space;
  if (frame.room.rotunda || backWallOpen(frame, doors)) return [];
  const scale = Math.min(1, frame.halfWidth / 1.5, (2 * frame.halfDepth - 0.5) / 1.5);
  if (scale < 0.6) return [];
  const discs = [-0.75, 0, 0.75].map((v) => pointIn(frame, frame.halfDepth - 0.55 * scale, v * scale));
  if (!discs.every((p) => isFree(space, p, 0.6 * scale, 0))) return [];
  discs.forEach((p) => take(space, p, 0.6 * scale));
  const wall = pointIn(frame, frame.halfDepth, 0);
  return [propAt(space, 'dais', wall, facingIn(frame), scale), propAt(space, item, pointIn(frame, frame.halfDepth - 0.75 * scale, 0), facingIn(frame))];
}

/** A tapestry on the back wall, where no door breaks it. */
export function tapestry(space: RoomSpace, doors: readonly DungeonDoor[]): DungeonProp[] {
  const { frame } = space;
  if (backWallOpen(frame, doors) || frame.halfWidth < 1) return [];
  const p = pointIn(frame, frame.halfDepth - 0.1, 0);
  const reach = pointIn(frame, frame.halfDepth - 0.4, 0);
  if (!isFree(space, reach, 0.35, 0)) return [];
  return [propAt(space, 'tapestry', p, facingIn(frame))];
}

const CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
/** A stack's places from its corner inwards, in cells along and across the room. */
const STACK: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.75, 0],
  [0, 0.75],
  [0.75, 0.75],
];

/** Crates, barrels or a chest gathered in a free corner. */
export function storage(rng: Rng, space: RoomSpace): DungeonProp[] {
  const { frame } = space;
  const tilt = (): number => (rng() - 0.5) * 0.4;
  const kinds: PropKind[] = rng() < 0.6 ? ['crate', 'crate', 'crate'] : ['barrel', 'barrel', 'barrel', 'barrel'];
  if (rng() < 0.25) kinds[0] = 'chest';
  const stack = kinds.slice(0, int(rng, 1, kinds.length));
  for (const [su, sv] of shuffled(rng, CORNERS)) {
    const spots = STACK.map(([du, dv]) => pointIn(frame, su * (frame.halfDepth - 0.5 - du), sv * (frame.halfWidth - 0.5 - dv)));
    if (!spots[0] || !isFree(space, spots[0], PROP_REACH[stack[0] ?? 'crate'])) continue;
    return stack.flatMap((kind, k) => {
      const spot = spots[k];
      return spot ? tryPlace(space, kind, spot, tilt()) : [];
    });
  }
  return [];
}

/** `count` ranks of a prop down the room, two abreast where the room is wide, lying along it. */
export function row(space: RoomSpace, kind: PropKind, count: number): DungeonProp[] {
  const { frame } = space;
  const out: DungeonProp[] = [];
  const along = Math.floor(frame.halfDepth * 2 - 0.5);
  const step = Math.max(1, along / Math.max(1, count));
  for (let k = 0; k < count; k++) {
    const u = -frame.halfDepth + step * (k + 0.5);
    for (const v of frame.halfWidth >= 1.5 ? [-0.75, 0.75] : [0]) {
      out.push(...tryPlace(space, kind, pointIn(frame, u, v * Math.min(1, frame.halfWidth - 0.75)), facingIn(frame)));
    }
  }
  return out;
}
