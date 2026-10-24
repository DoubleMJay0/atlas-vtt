import type { DoorKind } from '../model';
import type { DungeonParams, SizeStyle } from '../params';
import { type Rng, chance, int, pick, weighted } from '../rng';

export interface RoomSize {
  /** Walls included, odd. */
  width: number;
  /** Walls included, from the door row to the far wall. */
  depth: number;
}

function sizeOfStyle(rng: Rng, style: SizeStyle): RoomSize {
  switch (style) {
    case 0:
      return { width: pick(rng, [5, 7]), depth: int(rng, 4, 6) };
    case 1:
      return { width: pick(rng, [5, 7, 9]), depth: int(rng, 7, 9) };
    case 2:
      return { width: 3, depth: int(rng, 4, 5) };
    case 3:
      return { width: 3, depth: 3 };
  }
}

/** A normal room's size grown to a floor of `minFloor` cells each way; the walls count twice. */
function atLeast(size: RoomSize, minFloor: number): RoomSize {
  const least = minFloor + 2;
  return size.width >= least && size.depth >= least ? size : { width: Math.max(size.width, least + ((least + 1) % 2)), depth: Math.max(size.depth, least) };
}

/**
 * A new room's size; with `round`, half of the rooms come out square so they may be round. A
 * normal room grows to `minRoomFloor` after the draw, so the rolls stay as they were.
 */
export function drawSize(rng: Rng, params: DungeonParams): RoomSize {
  const style = pick(rng, params.sizeStyles);
  const drawn = sizeOfStyle(rng, style);
  const size = params.squareRooms && style <= 1 && chance(rng, 0.5) ? { width: drawn.width, depth: drawn.width } : drawn;
  return style <= 1 && params.minRoomFloor ? atLeast(size, params.minRoomFloor) : size;
}

/** A normal room's size, small or large but never a corridor: the room around a landing. */
export function drawRoomSize(rng: Rng, minFloor = 0): RoomSize {
  const size = sizeOfStyle(rng, pick<SizeStyle>(rng, [0, 0, 1]));
  return minFloor ? atLeast(size, minFloor) : size;
}

/** A small room's size: a storey's stair landing. */
export function drawSmallRoomSize(rng: Rng): RoomSize {
  return sizeOfStyle(rng, 0);
}

/** Ordinary doors: a door about three times in five, else an opening. */
const DOOR_WEIGHTS: readonly (readonly [DoorKind, number])[] = [
  ['door', 0.6],
  ['opening', 0.4],
];

/** The kind of a door between two rooms; corridors open into each other. */
export function drawDoorKind(rng: Rng, betweenCorridors: boolean): DoorKind {
  const kind = weighted(rng, DOOR_WEIGHTS);
  return betweenCorridors ? 'opening' : kind;
}
