/**
 * The floors of a house as drawn (`DungeonFloor.walls === 'edges'`): its walls stand on the edges
 * between cells, so each room's floor is its rectangle drawn back from every edge it shares with
 * the house by half an inner wall and from the house's outside by half an outer wall, and a doorway
 * is a thin floor across its edge that joins the two rooms. The renderer draws walls outside the
 * floors as it always does, so an inner wall comes out a thin line and an outer wall a full course.
 */

import { cellKey, doorCells, floorCellsOf } from '../geometry';
import type { CellDir, DungeonDoor, DungeonFloor, DungeonRoom, DungeonWindow } from '../model';
import type { RectShape, Vec } from './geometry';

/** An inner wall's thickness, in cells: wider than the widest wall ink (0.073), so the wall rings of two rooms never meet. */
export const INNER_WALL = 0.1;
/** An outer wall's thickness, in cells. */
export const OUTER_WALL = 0.16;
/** How far a doorway's floor reaches past the floors it joins, so the two become one. */
const OVERLAP = 0.01;
/** A window's span along its edge: wall stays at each end, so neighbouring windows never run together. */
export const WINDOW_INSET = 0.18;

/** The cells of a house: every room's floor and every stack, by key. */
export function houseCells(floor: Pick<DungeonFloor, 'rooms' | 'stacks'>): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const room of floor.rooms) for (const c of floorCellsOf(room)) keys.add(cellKey(c.x, c.y));
  for (const s of floor.stacks ?? []) for (let x = s.x; x < s.x + s.w; x++) for (let y = s.y; y < s.y + s.h; y++) keys.add(cellKey(x, y));
  return keys;
}

const SIDES: readonly CellDir[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** The cells across a room's side towards `side`. */
function beyond(room: Pick<DungeonRoom, 'x' | 'y' | 'w' | 'h'>, side: CellDir): Vec[] {
  if (side.y !== 0) {
    const y = side.y < 0 ? room.y - 1 : room.y + room.h;
    return Array.from({ length: room.w }, (_, k) => ({ x: room.x + k, y }));
  }
  const x = side.x < 0 ? room.x - 1 : room.x + room.w;
  return Array.from({ length: room.h }, (_, k) => ({ x, y: room.y + k }));
}

/** How far a room's floor stands back from its side towards `side`: half an outer wall where any of it faces the outside. */
export function sideInset(room: Pick<DungeonRoom, 'x' | 'y' | 'w' | 'h'>, side: CellDir, house: ReadonlySet<string>): number {
  return beyond(room, side).every((c) => house.has(cellKey(c.x, c.y))) ? INNER_WALL / 2 : OUTER_WALL / 2;
}

/** A room's floor in a house: its rectangle drawn back from each side by half the wall that stands there. */
export function houseRoomShape(room: Pick<DungeonRoom, 'x' | 'y' | 'w' | 'h'>, house: ReadonlySet<string>): RectShape {
  const [top, right, bottom, left] = SIDES.map((side) => sideInset(room, side, house)) as [number, number, number, number];
  return { kind: 'rect', x: room.x + left, y: room.y + top, w: room.w - left - right, h: room.h - top - bottom };
}

/** The line a door on an edge stands on: its two ends, from the first cell's side. */
export function doorEdge(door: Pick<DungeonDoor, 'x' | 'y' | 'dir' | 'wide'>): [Vec, Vec] {
  const cells = doorCells(door);
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs) + 1, Math.min(...ys), Math.max(...ys) + 1];
  const { dir } = door;
  if (dir.y !== 0) {
    const y = dir.y > 0 ? y1 : y0;
    return [{ x: x0, y }, { x: x1, y }];
  }
  const x = dir.x > 0 ? x1 : x0;
  return [{ x, y: y0 }, { x, y: y1 }];
}

/**
 * A doorway's floor: a rectangle across its edge, through the wall to the floor of the room on each
 * side (past it by a hair, so the floors join), or to the wall's outer face where a side is outside;
 * along its edge never past either room's floor, so one as long as the side it is in leaves the
 * walls round the corners whole.
 */
export function doorwayShape(door: DungeonDoor, rooms: ReadonlyMap<number, DungeonRoom>, house: ReadonlySet<string>): RectShape {
  const [a, b] = doorEdge(door);
  const vertical = door.dir.y !== 0;
  const shapes = [door.from, door.to].flatMap((id) => {
    const room = id === null ? undefined : rooms.get(id);
    return room ? [houseRoomShape(room, house)] : [];
  });
  const lo = Math.max(vertical ? a.x : a.y, ...shapes.map((s) => (vertical ? s.x : s.y)));
  const hi = Math.min(vertical ? b.x : b.y, ...shapes.map((s) => (vertical ? s.x + s.w : s.y + s.h)));
  const reach = (id: number | null, side: CellDir): number => {
    const room = id === null ? undefined : rooms.get(id);
    return room ? sideInset(room, side, house) + OVERLAP : OUTER_WALL / 2;
  };
  const back = reach(door.from, door.dir);
  const on = reach(door.to, { x: -door.dir.x, y: -door.dir.y } as CellDir);
  if (vertical) {
    const top = door.dir.y > 0 ? a.y - back : a.y - on;
    return { kind: 'rect', x: lo, y: top, w: hi - lo, h: back + on };
  }
  const left = door.dir.x > 0 ? a.x - back : a.x - on;
  return { kind: 'rect', x: left, y: lo, w: back + on, h: hi - lo };
}

/** A window's edge: where the glass stands, inset from the cell's corners, from one end to the other. */
export function windowSpan(window: Pick<DungeonWindow, 'x' | 'y' | 'dir'>): [Vec, Vec] {
  const [a, b] = doorEdge({ ...window });
  const t = { x: b.x - a.x, y: b.y - a.y };
  return [
    { x: a.x + t.x * WINDOW_INSET, y: a.y + t.y * WINDOW_INSET },
    { x: b.x - t.x * WINDOW_INSET, y: b.y - t.y * WINDOW_INSET },
  ];
}

/** The ground a window's wall leaves open: across its span, from inside the floor's edge out past the wall by `beyond` cells. */
export function windowClearing(window: Pick<DungeonWindow, 'x' | 'y' | 'dir'>, beyondWall: number): Vec[] {
  const [a, b] = windowSpan(window);
  const { dir } = window;
  const inner = OUTER_WALL / 2 + 0.02;
  const outer = OUTER_WALL / 2 + beyondWall;
  return [
    { x: a.x - dir.x * inner, y: a.y - dir.y * inner },
    { x: b.x - dir.x * inner, y: b.y - dir.y * inner },
    { x: b.x + dir.x * outer, y: b.y + dir.y * outer },
    { x: a.x + dir.x * outer, y: a.y + dir.y * outer },
  ];
}
