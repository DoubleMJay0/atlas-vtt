/**
 * Everything that stands or lies in a floor's rooms besides its terrain: columns, the furniture
 * each room's place in the architecture calls for (`props/roles.ts`, `props/furnish.ts`; about a
 * third of the rooms stay empty), rubble and cracks. Stairwells, the rows they are reached from,
 * the cells before doors and every cell terrain fills stay clear. Each room draws from a stream of
 * its own, so one room's things never move another's.
 */

import type { DungeonColumn, DungeonCrack, DungeonDoor, DungeonProp, DungeonRoom, DungeonRubble, DungeonStair, DungeonTerrain } from './model';
import type { DungeonParams } from './params';
import { cellKey, cellsOf, maskOf } from './geometry';
import { approachCells, doorApproaches, spotRect } from './floors/stairSpots';
import { columnStyle, colonnadeOf } from './props/columns';
import { type FloorFurnishing, arenaSeat, furnishRoom } from './props/furnish';
import type { RoomRoles } from './props/roles';
import { facing, frameOf } from './props/roomFrame';
import { cracksIn, rubbleIn } from './props/scatter';
import { roomSpace } from './props/space';
import { chance, floorStream, stream } from './rng';

export interface PropsResult {
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
  columns: readonly DungeonColumn[];
  terrain: readonly DungeonTerrain[];
  roles: RoomRoles;
  params: DungeonParams;
}

/** Rooms that get a few more stones in a crumbling dungeon. */
const CRUMBLED_SHARE = 1 / 3;
const CRUMBLED_RUBBLE = 3;

/** The cells a floor keeps clear: its stairwells, the rows they are reached from, the cells before its doors and its terrain. */
function clearCells(input: PropsInput): Set<string> {
  const { floor, rooms, doors, stairs, terrain } = input;
  const cells = [
    ...stairs.flatMap((s) => [...cellsOf(spotRect(s)), ...approachCells(s, s.to > floor ? 'upper' : 'lower')]),
    ...rooms.flatMap((room) => doorApproaches(room, doors)),
    ...terrain.flatMap((piece) => piece.cells),
  ];
  return new Set(cells.map((c) => cellKey(c.x, c.y)));
}

/** Whether a column stands on or against a stairwell. */
function inStairs(column: DungeonColumn, stairs: readonly DungeonStair[]): boolean {
  return stairs.some((s) => column.x >= s.x - column.radius && column.x <= s.x + s.w + column.radius && column.y >= s.y - column.radius && column.y <= s.y + s.h + column.radius);
}

/** A floor's columns: colonnades in the rooms that have them, off its stairwells. */
export function floorColumns(seed: number, floor: number, rooms: readonly DungeonRoom[], stairs: readonly DungeonStair[], params: DungeonParams): DungeonColumn[] {
  // A cave has no columns: its stalagmite columns are furniture.
  if (params.cave) return [];
  const style = columnStyle(stream(seed, 'props', 'style'), params.shatteredChance);
  return rooms.flatMap((room) => colonnadeOf(floorStream(seed, 'props', floor, `columns:${room.id}`), room, style).filter((c) => !inStairs(c, stairs)));
}

/** The boss arena's platform in `room`, if its terrain gave it one. */
function platformOf(input: PropsInput, room: DungeonRoom): DungeonTerrain | undefined {
  return room.boss ? input.terrain.find((p) => p.room === room.id && p.kind === 'platform' && p.facing) : undefined;
}

/** The seat on the boss arena's platform, at its middle, facing down its steps; none where the arena has no seat. */
function seatOnPlatform(platform: DungeonTerrain, room: DungeonRoom): DungeonProp[] {
  const kind = arenaSeat();
  if (!kind || !platform.facing) return [];
  const x = platform.cells.reduce((sum, c) => sum + c.x + 0.5, 0) / platform.cells.length;
  const y = platform.cells.reduce((sum, c) => sum + c.y + 0.5, 0) / platform.cells.length;
  return [{ kind, x, y, rotation: facing(platform.facing), scale: 1, room: room.id }];
}

export function placeProps(input: PropsInput): PropsResult {
  const { seed, floor, rooms, doors, stairs, columns, terrain, params } = input;
  const { roles, empty } = input.roles;
  const furnishing: FloorFurnishing = { tags: params.tags, tapestryChance: params.tapestryChance, fountainWeight: 1, wellPlaced: false };
  const clear = clearCells(input);
  const keepOff = [...stairs.flatMap((s) => cellsOf(spotRect(s))), ...terrain.flatMap((p) => p.cells)].map((c) => ({ x: c.x + 0.5, y: c.y + 0.5, radius: 0.75 }));
  const result: PropsResult = { props: [], rubble: [], cracks: [] };
  for (const room of rooms) {
    const rng = floorStream(seed, 'props', floor, room.id);
    const frame = frameOf(room);
    const space = roomSpace(frame, clear, columns, maskOf(room));
    const role = roles.get(room.id);
    const platform = platformOf(input, room);
    const props = platform ? seatOnPlatform(platform, room) : role && !empty.has(room.id) ? furnishRoom(rng, space, role, doors, furnishing) : [];
    const extra = params.tags.has('crumbling') && chance(rng, CRUMBLED_SHARE) ? CRUMBLED_RUBBLE : 0;
    result.props.push(...props);
    result.rubble.push(...rubbleIn(rng, frame, params.rubbleArea, extra, [...space.taken, ...keepOff]));
    result.cracks.push(...cracksIn(rng, frame, doors, params.crackChance));
  }
  return result;
}
