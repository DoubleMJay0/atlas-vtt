import type { DungeonModel } from '../model';
import type { NotesMode } from '../style';
import { roomCentre, type Canvas2D, type Vec } from './geometry';
import type { VisibleDungeon } from './visibleDungeon';

/** A number printed on the map, at a room's centre in cells. */
export interface RoomLabel {
  room: number;
  text: string;
  at: Vec;
}

/** Which rooms carry a number in a notes mode: the noted ones, or every room in Numbers. */
export function roomLabels(dungeon: VisibleDungeon, mode: NotesMode): RoomLabel[] {
  if (mode === 'off' || mode === 'tailed') return [];
  const centreOf = (id: number): Vec | null => {
    const room = dungeon.rooms.find(r => r.id === id);
    return room ? roomCentre(room) : null;
  };
  if (mode === 'numbers') {
    return roomsByDistance(dungeon.model)
      .filter(id => dungeon.roomShapes.has(id))
      .map((room, i) => ({ room, text: String(i + 1), at: centreOf(room)! }));
  }
  return dungeon.model.notes.flatMap(note => {
    const at = dungeon.roomShapes.has(note.room) ? centreOf(note.room) : null;
    return at ? [{ room: note.room, text: note.ref, at }] : [];
  });
}

/** Normal rooms, nearest the entrance first by the number of doors between. */
export function roomsByDistance(model: DungeonModel): number[] {
  const links = new Map<number, number[]>();
  for (const door of model.doors) {
    if (door.from === null || door.to === null) continue;
    links.set(door.from, [...(links.get(door.from) ?? []), door.to]);
    links.set(door.to, [...(links.get(door.to) ?? []), door.from]);
  }
  const start = model.doors.find(d => d.kind === 'entrance' && d.from === null)?.to ?? model.rooms[0]?.id;
  const depth = new Map<number, number>();
  if (start !== undefined) {
    depth.set(start, 0);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i]!;
      for (const next of links.get(at) ?? []) {
        if (depth.has(next)) continue;
        depth.set(next, depth.get(at)! + 1);
        queue.push(next);
      }
    }
  }
  return model.rooms
    .filter(room => room.kind === 'room')
    .map(room => room.id)
    .sort((a, b) => (depth.get(a) ?? Infinity) - (depth.get(b) ?? Infinity) || a - b);
}

/**
 * Prints numbers in screen pixels (the context unturned), each over a halo of floor colour so
 * it reads over grid and props.
 */
export function drawLabels(ctx: Canvas2D, labels: readonly { text: string; x: number; y: number }[], font: string, ink: string, halo: string, haloWidth: number): void {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = haloWidth;
  ctx.strokeStyle = halo;
  ctx.fillStyle = ink;
  for (const label of labels) {
    const m = ctx.measureText(label.text);
    // Centre the ink, not the em box: numerals sit on the baseline.
    const dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.strokeText(label.text, label.x, label.y + dy);
    ctx.fillText(label.text, label.x, label.y + dy);
  }
  ctx.restore();
}
