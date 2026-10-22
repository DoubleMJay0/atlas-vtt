/**
 * Doors in a room's outer wall: a rear entrance, and stairs down from the culmination. Such a door
 * needs a wall cell no other room uses and open ground outside it.
 */

import type { CellDir, CellPoint } from '../model';
import { dir, inRect, rectsTouch } from '../geometry';
import { ENTRANCE_BLOCK } from '../layout/grow';
import { type WorkLayout, type WorkRoom, localCell, roomRect } from '../layout/workLayout';

export interface OuterCell {
  cell: CellPoint;
  /** From the room out. */
  out: CellDir;
}

function covered(layout: WorkLayout, cell: CellPoint, except: number): boolean {
  return layout.rooms.some((room) => !room.removed && room.id !== except && inRect(roomRect(room), cell.x, cell.y));
}

function isDoorCell(layout: WorkLayout, cell: CellPoint): boolean {
  return layout.doors.some((door) => door.x === cell.x && door.y === cell.y);
}

function nearDoor(layout: WorkLayout, cell: CellPoint): boolean {
  return layout.doors.some((door) => Math.abs(door.x - cell.x) + Math.abs(door.y - cell.y) <= 1);
}

export function isFreeOuterCell(layout: WorkLayout, room: WorkRoom, cell: CellPoint, out: CellDir): boolean {
  const outside = { x: cell.x + out.x, y: cell.y + out.y };
  const outsideRect = { x0: outside.x, y0: outside.y, x1: outside.x, y1: outside.y };
  if (rectsTouch(outsideRect, ENTRANCE_BLOCK) || covered(layout, outside, -1)) return false;
  return !covered(layout, cell, room.id) && !isDoorCell(layout, cell) && !nearDoor(layout, cell);
}

/** Every wall cell of the room, corners left out, with the way out of the room there. */
function wallCells(room: WorkRoom): OuterCell[] {
  const cells: OuterCell[] = [];
  const half = (room.width - 1) / 2;
  const back = localCell(room, 1, 0);
  const front = localCell(room, 0, 0);
  const forward = dir(back.x - front.x, back.y - front.y);
  for (let j = -half + 1; j <= half - 1; j++) cells.push({ cell: localCell(room, room.depth - 1, j), out: forward });
  for (let i = 1; i <= room.depth - 2; i++) {
    for (const side of [-1, 1]) {
      const cell = localCell(room, i, side * half);
      const inner = localCell(room, i, side * (half - 1));
      cells.push({ cell, out: dir(cell.x - inner.x, cell.y - inner.y) });
    }
  }
  for (let j = -half + 1; j <= half - 1; j++) cells.push({ cell: localCell(room, 0, j), out: dir(-forward.x, -forward.y) });
  return cells;
}

export function freeOuterCells(layout: WorkLayout, room: WorkRoom): OuterCell[] {
  return wallCells(room).filter(({ cell, out }) => isFreeOuterCell(layout, room, cell, out));
}
