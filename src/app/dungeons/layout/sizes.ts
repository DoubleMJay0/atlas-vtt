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

/** A new room's size; with `round`, half of the rooms come out square so they may be round. */
export function drawSize(rng: Rng, params: DungeonParams): RoomSize {
  const style = pick(rng, params.sizeStyles);
  const size = sizeOfStyle(rng, style);
  if (params.squareRooms && style <= 1 && chance(rng, 0.5)) return { width: size.width, depth: size.width };
  return size;
}

/** A normal room's size, small or large but never a corridor: the room around a landing. */
export function drawRoomSize(rng: Rng): RoomSize {
  return sizeOfStyle(rng, pick<SizeStyle>(rng, [0, 0, 1]));
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
