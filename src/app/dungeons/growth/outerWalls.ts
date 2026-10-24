/** The floor cells of a room that lie along an outer wall: a side with no other room's walls on it or a cell beyond. */

import { type CellRect, cellKey, rectsTouch, wallRect } from '../geometry';
import type { DungeonRoom } from '../model';

export function outerWallCells(room: DungeonRoom, rooms: readonly DungeonRoom[]): Set<string> {
  const out = new Set<string>();
  if (room.rotunda) return out;
  const w = wallRect(room);
  const others = rooms.filter((r) => r.id !== room.id).map(wallRect);
  const x1 = room.x + room.w - 1;
  const y1 = room.y + room.h - 1;
  const sides: { band: CellRect; edge: CellRect }[] = [
    { band: { x0: w.x0 + 1, x1: w.x1 - 1, y0: w.y0 - 1, y1: w.y0 }, edge: { x0: room.x, x1, y0: room.y, y1: room.y } },
    { band: { x0: w.x0 + 1, x1: w.x1 - 1, y0: w.y1, y1: w.y1 + 1 }, edge: { x0: room.x, x1, y0: y1, y1 } },
    { band: { x0: w.x0 - 1, x1: w.x0, y0: w.y0 + 1, y1: w.y1 - 1 }, edge: { x0: room.x, x1: room.x, y0: room.y, y1 } },
    { band: { x0: w.x1, x1: w.x1 + 1, y0: w.y0 + 1, y1: w.y1 - 1 }, edge: { x0: x1, x1, y0: room.y, y1 } },
  ];
  for (const { band, edge } of sides) {
    if (others.some((o) => rectsTouch(band, o))) continue;
    for (let y = edge.y0; y <= edge.y1; y++) for (let x = edge.x0; x <= edge.x1; x++) out.add(cellKey(x, y));
  }
  return out;
}
