/**
 * Where disc furniture stands against a room's back wall: on a dais, or hung on the wall itself.
 * Each placement is tried against the room's free floor (`RoomSpace`) and takes what it uses; a
 * placement that finds no room adds nothing.
 */

import type { CellPoint, DungeonDoor, DungeonProp, PropKind } from '../model';
import { backWallOpen, facingIn, pointIn } from './roomFrame';
import { type EdgeSpot, type RoomSpace, edgeSpots, isFree, take } from './space';

function propAt(space: RoomSpace, kind: PropKind, p: CellPoint, rotation: number, scale = 1): DungeonProp {
  return { kind, x: p.x, y: p.y, rotation, scale, room: space.frame.room.id };
}

/**
 * Where the back wall of a room that names its cells (a cave's chamber) runs: places half a cell
 * before it, facing in, nearest the middle of its rectangle's back wall first.
 */
function backWallSpots(space: RoomSpace): EdgeSpot[] {
  const { frame } = space;
  const middle = pointIn(frame, frame.halfDepth, 0);
  return edgeSpots(space, 1)
    .filter((spot) => spot.inward.x === -frame.axis.x && spot.inward.y === -frame.axis.y)
    .sort((a, b) => Math.hypot(a.point.x - middle.x, a.point.y - middle.y) - Math.hypot(b.point.x - middle.x, b.point.y - middle.y));
}

/** A point `distance` before the wall a spot lies half a cell before. */
const beforeWall = (spot: EdgeSpot, distance: number): CellPoint => ({ x: spot.point.x + spot.inward.x * (distance - 0.5), y: spot.point.y + spot.inward.y * (distance - 0.5) });

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
  if (space.cells) {
    const spot = backWallSpots(space).find((s) => isFree(space, beforeWall(s, 0.4), 0.35, 0));
    return spot ? [propAt(space, 'tapestry', beforeWall(spot, 0.1), facingIn(frame))] : [];
  }
  const p = pointIn(frame, frame.halfDepth - 0.1, 0);
  const reach = pointIn(frame, frame.halfDepth - 0.4, 0);
  if (!isFree(space, reach, 0.35, 0)) return [];
  return [propAt(space, 'tapestry', p, facingIn(frame))];
}
