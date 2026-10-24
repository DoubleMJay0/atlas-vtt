/**
 * The free floor of a room as furnishing sees it: what is already there (columns, props placed so
 * far) and what must stay clear (the cells before its doors, a stairwell and the row it is reached
 * from). A prop is a disc of its footprint; a tapestry hangs on its wall and needs only that.
 */

import type { CellPoint, DungeonColumn } from '../model';
import type { RoomFrame } from './roomFrame';
import { onFloor } from './roomFrame';

/** A disc that is taken. */
export interface Taken {
  x: number;
  y: number;
  radius: number;
}

export interface RoomSpace {
  frame: RoomFrame;
  /** Cells to keep clear, as `x,y`. */
  clear: ReadonlySet<string>;
  taken: Taken[];
}

export function roomSpace(frame: RoomFrame, clear: ReadonlySet<string>, columns: readonly DungeonColumn[]): RoomSpace {
  return { frame, clear, taken: columns.map((c) => ({ x: c.x, y: c.y, radius: c.radius + 0.1 })) };
}

/** Whether a disc of `radius` around `p` overlaps the cell (x, y). */
function overlapsCell(p: CellPoint, radius: number, x: number, y: number): boolean {
  const dx = Math.max(x - p.x, 0, p.x - (x + 1));
  const dy = Math.max(y - p.y, 0, p.y - (y + 1));
  return dx * dx + dy * dy < radius * radius;
}

/** Whether a disc of `radius` around `p` lies on the floor, off every cell to keep clear and everything taken. */
export function isFree(space: RoomSpace, p: CellPoint, radius: number, margin = radius): boolean {
  if (!onFloor(space.frame, p, margin)) return false;
  for (let y = Math.floor(p.y - radius); y <= Math.floor(p.y + radius); y++) {
    for (let x = Math.floor(p.x - radius); x <= Math.floor(p.x + radius); x++) {
      if (space.clear.has(`${x},${y}`) && overlapsCell(p, radius, x, y)) return false;
    }
  }
  return space.taken.every((t) => Math.hypot(t.x - p.x, t.y - p.y) >= t.radius + radius);
}

export function take(space: RoomSpace, p: CellPoint, radius: number): void {
  space.taken.push({ x: p.x, y: p.y, radius });
}
