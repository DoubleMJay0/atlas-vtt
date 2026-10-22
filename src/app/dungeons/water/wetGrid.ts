/**
 * Which cells are under water. Floors below the level are wet; so are the walls around them,
 * so pools reach the walls, except where a wall also borders a dry floor: water never shows
 * through a wall into the next room. Enclosed dry pockets are filled, so every pool is one outline.
 */

import type { CellPoint, DungeonRoom } from '../model';
import { type CellRect, wallRect } from '../geometry';

export interface CellGrid {
  /** Cell coordinates of index 0. */
  x0: number;
  y0: number;
  w: number;
  h: number;
}

export const DRY = 0;
export const WET = 1;

/** The rooms' walled extent with one free cell all round. */
export function gridAround(rooms: readonly DungeonRoom[]): CellGrid {
  const rects = rooms.map(wallRect);
  const x0 = Math.min(...rects.map((r) => r.x0)) - 1;
  const y0 = Math.min(...rects.map((r) => r.y0)) - 1;
  const x1 = Math.max(...rects.map((r) => r.x1)) + 1;
  const y1 = Math.max(...rects.map((r) => r.y1)) + 1;
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function indexOf(grid: CellGrid, x: number, y: number): number {
  const gx = x - grid.x0;
  const gy = y - grid.y0;
  return gx < 0 || gy < 0 || gx >= grid.w || gy >= grid.h ? -1 : gy * grid.w + gx;
}

export function floorCells(rooms: readonly DungeonRoom[]): CellPoint[] {
  const cells: CellPoint[] = [];
  for (const room of rooms) for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) cells.push({ x, y });
  return cells;
}

function markRects(grid: CellGrid, rects: readonly CellRect[]): Uint8Array {
  const marks = new Uint8Array(grid.w * grid.h);
  for (const r of rects) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) marks[indexOf(grid, x, y)] = 1;
  return marks;
}

const NEAR4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const NEAR8: readonly (readonly [number, number])[] = [...NEAR4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

function fillPockets(grid: CellGrid, wet: Uint8Array): void {
  const outside = new Uint8Array(wet.length);
  const stack = [0];
  outside[0] = 1;
  while (stack.length > 0) {
    const at = stack.pop() as number;
    const x = at % grid.w;
    const y = (at - x) / grid.w;
    for (const [dx, dy] of NEAR4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.w || ny >= grid.h) continue;
      const next = ny * grid.w + nx;
      if (outside[next] || wet[next] === WET) continue;
      outside[next] = 1;
      stack.push(next);
    }
  }
  outside.forEach((out, i) => {
    if (!out) wet[i] = WET;
  });
}

/** The wet cells: `wetFloor` holds wet floor cells by grid index. */
export function wetGrid(grid: CellGrid, rooms: readonly DungeonRoom[], wetFloor: Uint8Array): Uint8Array {
  const floor = markRects(
    grid,
    rooms.map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1 })),
  );
  const walled = markRects(grid, rooms.map(wallRect));
  const wet = new Uint8Array(wetFloor);
  const at = (x: number, y: number, marks: Uint8Array): number => (x < 0 || y < 0 || x >= grid.w || y >= grid.h ? 0 : (marks[y * grid.w + x] ?? 0));
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const i = y * grid.w + x;
      if (!walled[i] || floor[i]) continue;
      const nearWet = NEAR8.some(([dx, dy]) => at(x + dx, y + dy, wetFloor) === WET);
      const nearDry = NEAR4.some(([dx, dy]) => at(x + dx, y + dy, floor) === 1 && at(x + dx, y + dy, wetFloor) !== WET);
      if (nearWet && !nearDry) wet[i] = WET;
    }
  }
  fillPockets(grid, wet);
  return wet;
}
