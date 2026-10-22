import type { CellPoint, DungeonModel, DungeonNote } from './model';
import { roomsByDistance } from './numbering';

/**
 * What the GM changed by hand on a generated dungeon: the story typed on the page, and per room
 * its note's text, where its box was dragged, or that the note was deleted. Kept apart from the
 * model, so the same edits lie over the dungeon again when only its look changes, and dropped
 * when the dungeon itself is generated anew. A title typed on the page is the dungeon's name
 * (`DungeonRequest.name`), as in the Name field.
 */
export interface NoteEdit {
  /** The note's text; on a room without a note, a note added. */
  text?: string;
  /** Where its box was dragged, in cells. */
  manual?: CellPoint;
  deleted?: true;
}

export interface DungeonEdits {
  story?: string;
  /** By room id. */
  notes: Readonly<Record<number, NoteEdit>>;
}

export const NO_EDITS: DungeonEdits = { notes: {} };

export function hasEdits(edits: DungeonEdits): boolean {
  return edits.story !== undefined || Object.keys(edits.notes).length > 0;
}

/** `edits` with the note of `room` changed by `change`; a field set to undefined is removed. */
export function withNoteEdit(edits: DungeonEdits, room: number, change: NoteEdit | null): DungeonEdits {
  const notes: Record<number, NoteEdit> = { ...edits.notes };
  if (change === null) delete notes[room];
  else notes[room] = change;
  return { ...edits, notes };
}

/** `edits` without any box the GM dragged. */
export function withoutManualPlaces(edits: DungeonEdits): DungeonEdits {
  const notes: Record<number, NoteEdit> = {};
  for (const [room, edit] of Object.entries(edits.notes)) {
    const { manual: _manual, ...rest } = edit;
    if (Object.keys(rest).length > 0) notes[Number(room)] = rest;
  }
  return { ...edits, notes };
}

/**
 * The model as the GM left it: the story replaced, notes changed, added or deleted, and the
 * notes numbered again by their rooms' distance from the entrance (`roomsByDistance`), as the
 * generator numbers them, so an added note takes its place in the order.
 */
export function applyDungeonEdits(model: DungeonModel, edits: DungeonEdits): DungeonModel {
  if (!hasEdits(edits)) return model;
  const rooms = new Set(model.rooms.map((room) => room.id));
  const byRoom = new Map(model.notes.map((note) => [note.room, note] as const));
  for (const [key, edit] of Object.entries(edits.notes)) {
    const room = Number(key);
    if (!rooms.has(room)) continue;
    const note = byRoom.get(room);
    const text = (edit.text ?? note?.text ?? '').trim();
    if (edit.deleted || text === '') {
      byRoom.delete(room);
      continue;
    }
    const manual = edit.manual ?? note?.manual;
    byRoom.set(room, { ref: '', room, text, ...(manual ? { manual } : {}) });
  }
  const order = roomsByDistance(model.rooms, model.doors);
  const notes: DungeonNote[] = order.flatMap((room) => {
    const note = byRoom.get(room);
    return note ? [note] : [];
  }).map((note, index) => ({ ...note, ref: String(index + 1) }));
  return {
    ...model,
    story: edits.story ?? model.story,
    notes,
  };
}
