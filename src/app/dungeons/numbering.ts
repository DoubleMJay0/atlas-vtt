/**
 * Room numbers follow the way in: the nearest room by walking cost from the first room is 1.
 * Ties go to the lower room id, so numbering never depends on note order.
 */

import { adjacency, pathCosts } from './layout/graph';
import type { DungeonDoor, DungeonNote, DungeonRoom } from './model';
import type { NoteText } from './text/contract';

/** Walking cost from the first room to every room. */
function costsFromFirstRoom(rooms: readonly DungeonRoom[], doors: readonly DungeonDoor[]): number[] {
  if (rooms.length === 0) return [];
  return pathCosts(adjacency(rooms.length, doors, (id) => rooms[id]?.kind === 'room'), 0);
}

/** Room ids nearest first; rooms no way leads to come last. */
export function roomsByDistance(rooms: readonly DungeonRoom[], doors: readonly DungeonDoor[]): number[] {
  const costs = costsFromFirstRoom(rooms, doors);
  return rooms
    .map((room) => room.id)
    .sort((a, b) => {
      const ca = costs[a] ?? Infinity;
      const cb = costs[b] ?? Infinity;
      if (ca === cb) return a - b;
      return ca === Infinity ? 1 : cb === Infinity ? -1 : ca - cb;
    });
}

/** The notes, numbered 1..n by their rooms' distance; notes about rooms that do not exist are dropped. */
export function numberNotes(rooms: readonly DungeonRoom[], doors: readonly DungeonDoor[], texts: readonly NoteText[]): DungeonNote[] {
  const order = roomsByDistance(rooms, doors);
  const rank = new Map(order.map((id, index) => [id, index]));
  return texts
    .filter((note) => rank.has(note.room) && note.text.trim() !== '')
    .sort((a, b) => (rank.get(a.room) ?? 0) - (rank.get(b.room) ?? 0))
    .map((note, index) => ({ ref: String(index + 1), text: note.text, room: note.room }));
}
