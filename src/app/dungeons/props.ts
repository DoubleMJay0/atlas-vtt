/**
 * Everything that stands or lies in a floor's rooms: columns, the furniture each room's place in
 * the architecture calls for (`props/roles.ts`, `props/furnish.ts`; about a third of the rooms
 * stay empty), rubble and cracks. Stairwells, the rows they are reached from and the cells before
 * doors stay clear. Each room draws from a stream of its own, so one room's things never move another's.
 */

import type { DungeonColumn, DungeonCrack, DungeonDoor, DungeonProp, DungeonRoom, DungeonRubble, DungeonStair } from './model';
import type { DungeonParams } from './params';
import { cellKey, cellsOf } from './geometry';
import { approachCells, doorApproaches, spotRect } from './floors/stairSpots';
import { columnStyle, colonnadeOf } from './props/columns';
import { type FloorFurnishing, furnishRoom } from './props/furnish';
import { roomRoles } from './props/roles';
import { frameOf } from './props/roomFrame';
import { cracksIn, rubbleIn } from './props/scatter';
import { roomSpace } from './props/space';
import { chance, floorStream, stream } from './rng';

export interface PropsResult {
  columns: DungeonColumn[];
  props: DungeonProp[];
  rubble: DungeonRubble[];
  cracks: DungeonCrack[];
}

export interface PropsInput {
  seed: number;
  /** The floor's index. */
  floor: number;
  rooms: readonly DungeonRoom[];
  doors: readonly DungeonDoor[];
  stairs: readonly DungeonStair[];
  params: DungeonParams;
}

/** Rooms that get a few more stones in a crumbling dungeon. */
const CRUMBLED_SHARE = 1 / 3;
const CRUMBLED_RUBBLE = 3;

/** The cells a floor keeps clear: its stairwells, the rows they are reached from, and the cells before its doors. */
function clearCells(floor: number, rooms: readonly DungeonRoom[], doors: readonly DungeonDoor[], stairs: readonly DungeonStair[]): Set<string> {
  const cells = [
    ...stairs.flatMap((s) => [...cellsOf(spotRect(s)), ...approachCells(s, s.to > floor ? 'upper' : 'lower')]),
    ...rooms.flatMap((room) => doorApproaches(room, doors)),
  ];
  return new Set(cells.map((c) => cellKey(c.x, c.y)));
}

/** Whether a column stands on or against a stairwell. */
function inStairs(column: DungeonColumn, stairs: readonly DungeonStair[]): boolean {
  return stairs.some((s) => column.x >= s.x - column.radius && column.x <= s.x + s.w + column.radius && column.y >= s.y - column.radius && column.y <= s.y + s.h + column.radius);
}

export function placeProps(input: PropsInput): PropsResult {
  const { seed, floor, rooms, doors, stairs, params } = input;
  const style = columnStyle(stream(seed, 'props', 'style'), params.shatteredChance);
  const { roles, empty } = roomRoles(floorStream(seed, 'props', floor, 'roles'), { rooms, doors, stairs });
  const furnishing: FloorFurnishing = { tags: params.tags, tapestryChance: params.tapestryChance, fountainWeight: 1, wellPlaced: false };
  const clear = clearCells(floor, rooms, doors, stairs);
  const stairStones = stairs.flatMap((s) => cellsOf(spotRect(s)).map((c) => ({ x: c.x + 0.5, y: c.y + 0.5, radius: 0.75 })));
  const result: PropsResult = { columns: [], props: [], rubble: [], cracks: [] };
  for (const room of rooms) {
    const rng = floorStream(seed, 'props', floor, room.id);
    const frame = frameOf(room);
    const columns = colonnadeOf(floorStream(seed, 'props', floor, `columns:${room.id}`), room, style).filter((c) => !inStairs(c, stairs));
    const space = roomSpace(frame, clear, columns);
    const role = roles.get(room.id);
    const props = role && !empty.has(room.id) ? furnishRoom(rng, space, role, doors, furnishing) : [];
    const extra = params.tags.has('crumbling') && chance(rng, CRUMBLED_SHARE) ? CRUMBLED_RUBBLE : 0;
    result.columns.push(...columns);
    result.props.push(...props);
    result.rubble.push(...rubbleIn(rng, frame, params.rubbleArea, extra, [...space.taken, ...stairStones]));
    result.cracks.push(...cracksIn(rng, frame, doors, params.crackChance));
  }
  return result;
}
