/**
 * Cell geometry shared by layout, water, props and the renderer.
 *
 * Cells are integers; cell (x, y) covers the square [x, x + 1) × [y, y + 1). Points (columns,
 * props, water, rubble, cracks) live in that continuous space, so a cell's centre is (x + .5, y + .5).
 */

import type { CellDir, CellPoint, DungeonDoor, DungeonRoom } from './model';

/** An inclusive rectangle of cells. */
export interface CellRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function unit(n: number): -1 | 0 | 1 {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

export function dir(x: number, y: number): CellDir {
  return { x: unit(x), y: unit(y) };
}

/** The axis turned a quarter clockwise on screen (y down). */
export function perpendicular(axis: CellDir): CellDir {
  return dir(-axis.y, axis.x);
}

export function inRect(rect: CellRect, x: number, y: number): boolean {
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0) + 1;
}

/** Rectangles that share any cell. */
export function rectsTouch(a: CellRect, b: CellRect): boolean {
  return overlap(a.x0, a.x1, b.x0, b.x1) > 0 && overlap(a.y0, a.y1, b.y0, b.y1) > 0;
}

/** Walled rooms that overlap by more than a shared wall: more than one cell both ways. */
export function rectsClash(a: CellRect, b: CellRect): boolean {
  return overlap(a.x0, a.x1, b.x0, b.x1) > 1 && overlap(a.y0, a.y1, b.y0, b.y1) > 1;
}

/** The overlap of two rectangles, or null. */
export function intersection(a: CellRect, b: CellRect): CellRect | null {
  const r = { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) };
  return r.x0 <= r.x1 && r.y0 <= r.y1 ? r : null;
}

export function floorRect(room: Pick<DungeonRoom, 'x' | 'y' | 'w' | 'h'>): CellRect {
  return { x0: room.x, y0: room.y, x1: room.x + room.w - 1, y1: room.y + room.h - 1 };
}

/** The floor with its ring of walls. */
export function wallRect(room: Pick<DungeonRoom, 'x' | 'y' | 'w' | 'h'>): CellRect {
  return { x0: room.x - 1, y0: room.y - 1, x1: room.x + room.w, y1: room.y + room.h };
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function cellsOf(rect: CellRect): CellPoint[] {
  const cells: CellPoint[] = [];
  for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) cells.push({ x, y });
  return cells;
}

/** A room's floor: the cells a cave shaped it to, else its rectangle. */
export function floorCellsOf(room: Pick<DungeonRoom, 'x' | 'y' | 'w' | 'h' | 'cells'>): CellPoint[] {
  return room.cells ?? cellsOf(floorRect(room));
}

const maskKeys = new WeakMap<readonly CellPoint[], ReadonlySet<string>>();

function keysOf(cells: readonly CellPoint[]): ReadonlySet<string> {
  let keys = maskKeys.get(cells);
  if (!keys) {
    keys = new Set(cells.map((c) => cellKey(c.x, c.y)));
    maskKeys.set(cells, keys);
  }
  return keys;
}

/** Whether the cell is floor of the room: in its mask, else in its rectangle. */
export function holdsCell(room: Pick<DungeonRoom, 'x' | 'y' | 'w' | 'h' | 'cells'>, x: number, y: number): boolean {
  return room.cells ? keysOf(room.cells).has(cellKey(x, y)) : inRect(floorRect(room), x, y);
}

/** The cells a door stands in: its own, and the one beside it where it is a narrows two cells wide. */
export function doorCells(door: Pick<DungeonDoor, 'x' | 'y' | 'wide'>): CellPoint[] {
  const own = { x: door.x, y: door.y };
  return door.wide ? [own, { x: door.x + door.wide.x, y: door.y + door.wide.y }] : [own];
}
