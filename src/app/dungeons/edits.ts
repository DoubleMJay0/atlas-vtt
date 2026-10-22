import type { CellPoint, DungeonModel, DungeonNote } from './model';
import { roomsByDistance } from './numbering';

/**
 * What the GM changed by hand on a generated dungeon: the title and story typed on the page, the
 * secret wings hidden, and per room its note's text, where its box was dragged, or that the note
 * was deleted. Kept apart from the model, so the same edits lie over the dungeon again when only
 * its look changes, and dropped when the dungeon itself is generated anew. A title typed on the
 * page renames this dungeon only; the Name field asks for another dungeon (`DungeonRequest.name`).
 */
export interface NoteEdit {
  /** The note's text; on a room without a note, a note added. */
  text?: string;
  /** Where its box was dragged, in cells. */
  manual?: CellPoint;
  deleted?: true;
}

export interface DungeonEdits {
  title?: string;
  story?: string;
  /** Secret wings hidden by hand, by the id of each wing's first room (`secretWingOf`). */
  hiddenWings?: readonly number[];
  /** By room id. */
  notes: Readonly<Record<number, NoteEdit>>;
}

export const NO_EDITS: DungeonEdits = { notes: {} };

export function hasEdits(edits: DungeonEdits): boolean {
  return edits.title !== undefined || edits.story !== undefined || (edits.hiddenWings?.length ?? 0) > 0 || Object.keys(edits.notes).length > 0;
}

/**
 * `edits` with the note of `room` changed by `change`, merged over what was edited before (a
 * retyped note keeps where its box was dragged); a deletion replaces it, null forgets it.
 */
export function withNoteEdit(edits: DungeonEdits, room: number, change: NoteEdit | null): DungeonEdits {
  const notes: Record<number, NoteEdit> = { ...edits.notes };
  if (change === null) delete notes[room];
  else if (change.deleted) notes[room] = change;
  else {
    const { deleted: _deleted, ...kept } = notes[room] ?? {};
    notes[room] = { ...kept, ...change };
  }
  return { ...edits, notes };
}

/** `edits` with the secret wing `wing` hidden too. */
export function withWingHidden(edits: DungeonEdits, wing: number): DungeonEdits {
  const hidden = edits.hiddenWings ?? [];
  return hidden.includes(wing) ? edits : { ...edits, hiddenWings: [...hidden, wing] };
}

/**
 * `edits` for the notes worded anew: what the GM typed, added or deleted belonged to the old
 * wording and goes; where a box was dragged stays, as do title, story and hidden wings.
 */
export function withoutNoteTexts(edits: DungeonEdits): DungeonEdits {
  const notes: Record<number, NoteEdit> = {};
  for (const [room, edit] of Object.entries(edits.notes)) {
    if (edit.manual && !edit.deleted) notes[Number(room)] = { manual: edit.manual };
  }
  return { ...edits, notes };
}

/**
 * The model as the GM left it: title and story replaced, wings hidden, notes changed, added or deleted, and the
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
  const hiddenWings = (edits.hiddenWings ?? []).filter((wing) => rooms.has(wing));
  return {
    ...model,
    title: edits.title ?? model.title,
    story: edits.story ?? model.story,
    notes,
    ...(hiddenWings.length > 0 ? { hiddenWings } : {}),
  };
}
