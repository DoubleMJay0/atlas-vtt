/**
 * Cell geometry shared by layout, water, props and the renderer.
 *
 * Cells are integers; cell (x, y) covers the square [x, x + 1) × [y, y + 1). Points (columns,
 * props, water, rubble, cracks) live in that continuous space, so a cell's centre is (x + .5, y + .5).
 */

import type { CellDir, CellPoint, DungeonModel, DungeonRoom } from './model';

/** An inclusive rectangle of cells. */
export interface CellRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A rectangle in the continuous plane. */
export interface DungeonBounds {
  x: number;
  y: number;
  w: number;
  h: number;
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

export function floorRect(room: DungeonRoom): CellRect {
  return { x0: room.x, y0: room.y, x1: room.x + room.w - 1, y1: room.y + room.h - 1 };
}

/** The floor with its ring of walls. */
export function wallRect(room: DungeonRoom): CellRect {
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

/** Everything the dungeon covers, walls and outer door cells included. */
export function dungeonBounds(model: Pick<DungeonModel, 'rooms' | 'doors'>): DungeonBounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const take = (r: CellRect): void => {
    x0 = Math.min(x0, r.x0);
    y0 = Math.min(y0, r.y0);
    x1 = Math.max(x1, r.x1);
    y1 = Math.max(y1, r.y1);
  };
  model.rooms.forEach((room) => take(wallRect(room)));
  model.doors.forEach((door) => take({ x0: door.x, y0: door.y, x1: door.x, y1: door.y }));
  if (x0 > x1) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
