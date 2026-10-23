/** Rubble on the floors and cracks running from the walls. */

import type { CellPoint, DungeonCrack, DungeonDoor, DungeonRubble } from '../model';
import { type Rng, chance, int } from '../rng';
import { chaikin } from '../water/smooth';
import type { Taken } from './space';
import { type RoomFrame, onFloor, pointIn, rotundaRadius } from './roomFrame';

function stone(rng: Rng, at: CellPoint): DungeonRubble {
  const size = 0.07 + rng() * 0.08;
  const start = rng() * Math.PI * 2;
  const quad = [0, 1, 2, 3].map((k) => {
    const angle = start + (k / 4) * Math.PI * 2 + (rng() - 0.5) * 0.8;
    const r = size * (0.7 + rng() * 0.6);
    return { x: at.x + Math.cos(angle) * r, y: at.y + Math.sin(angle) * r };
  });
  return { points: chaikin(quad, 1) };
}

/** About one stone per `areaPerStone` floor cells, at random; `extra` more where the plan marks rubble. */
export function rubbleIn(rng: Rng, frame: RoomFrame, areaPerStone: number, extra: number, obstacles: readonly Taken[]): DungeonRubble[] {
  const area = frame.room.w * frame.room.h;
  const count = Math.floor(rng() * (1 + area / areaPerStone)) + extra;
  const out: DungeonRubble[] = [];
  for (let tries = 0; out.length < count && tries < count * 6; tries++) {
    const at = pointIn(frame, (rng() * 2 - 1) * frame.halfDepth, (rng() * 2 - 1) * frame.halfWidth);
    if (!onFloor(frame, at, 0.15) || obstacles.some((o) => Math.hypot(o.x - at.x, o.y - at.y) < o.radius)) continue;
    out.push(stone(rng, at));
  }
  return out;
}

function crackFrom(rng: Rng, { at: start, inward, reach }: CrackStart): DungeonCrack {
  const turn = (rng() - 0.5) * 1;
  const ix = inward.x * Math.cos(turn) - inward.y * Math.sin(turn);
  const iy = inward.x * Math.sin(turn) + inward.y * Math.cos(turn);
  const length = Math.min(reach, 0.5 + rng() * 1);
  const segments = int(rng, 3, 5);
  const points: CellPoint[] = [start];
  for (let k = 1; k <= segments; k++) {
    const t = (k / segments) * length;
    const side = (k % 2 === 0 ? 1 : -1) * (0.05 + rng() * 0.12) * (k < segments ? 1 : 0);
    points.push({ x: start.x + ix * t - iy * side, y: start.y + iy * t + ix * side });
  }
  return { points, width: 0.05 + rng() * 0.05 };
}

interface CrackStart {
  at: CellPoint;
  inward: CellPoint;
  /** How far into the room a crack may run. */
  reach: number;
}

/** The middle of every wall cell edge along the floor, away from doors. */
function wallStarts(frame: RoomFrame, doors: readonly DungeonDoor[]): CrackStart[] {
  const { room } = frame;
  const isDoor = (x: number, y: number): boolean => doors.some((d) => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1);
  const starts: CrackStart[] = [];
  for (let x = room.x; x < room.x + room.w; x++) {
    if (!isDoor(x, room.y - 1)) starts.push({ at: { x: x + 0.5, y: room.y }, inward: { x: 0, y: 1 }, reach: room.h * 0.6 });
    if (!isDoor(x, room.y + room.h)) starts.push({ at: { x: x + 0.5, y: room.y + room.h }, inward: { x: 0, y: -1 }, reach: room.h * 0.6 });
  }
  for (let y = room.y; y < room.y + room.h; y++) {
    if (!isDoor(room.x - 1, y)) starts.push({ at: { x: room.x, y: y + 0.5 }, inward: { x: 1, y: 0 }, reach: room.w * 0.6 });
    if (!isDoor(room.x + room.w, y)) starts.push({ at: { x: room.x + room.w, y: y + 0.5 }, inward: { x: -1, y: 0 }, reach: room.w * 0.6 });
  }
  return starts;
}

function circleStarts(rng: Rng, frame: RoomFrame): CrackStart[] {
  const r = rotundaRadius(frame.room);
  const count = Math.round(Math.PI * 2 * r);
  const starts = Array.from({ length: count }, (_, k): CrackStart => {
    const angle = ((k + rng()) / count) * Math.PI * 2;
    const out = { x: Math.cos(angle), y: Math.sin(angle) };
    return { at: { x: frame.centre.x + out.x * r, y: frame.centre.y + out.y * r }, inward: { x: -out.x, y: -out.y }, reach: r };
  });
  // Doors of a round room sit at its four cardinal points.
  return starts.filter(({ inward }) => Math.min(Math.abs(inward.x), Math.abs(inward.y)) > 0.3);
}

/** Each wall cell starts a crack with the dungeon's crack chance. */
export function cracksIn(rng: Rng, frame: RoomFrame, doors: readonly DungeonDoor[], crackChance: number): DungeonCrack[] {
  const starts = frame.room.rotunda ? circleStarts(rng, frame) : wallStarts(frame, doors);
  return starts.filter(() => chance(rng, crackChance)).map((start) => crackFrom(rng, start));
}
