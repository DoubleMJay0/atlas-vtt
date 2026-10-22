import type { DungeonModel } from './model';

/**
 * What the GM changed by hand on a generated dungeon: the secret wings hidden. Kept apart from the
 * model, so they lie over the dungeon again when only its look changes, and dropped when the
 * dungeon itself is generated anew.
 */
export interface DungeonEdits {
  /** Secret wings hidden by hand, by the id of each wing's first room (`secretWingOf`). */
  hiddenWings?: readonly number[];
}

export const NO_EDITS: DungeonEdits = {};

/** `edits` with the secret wing `wing` hidden too. */
export function withWingHidden(edits: DungeonEdits, wing: number): DungeonEdits {
  const hidden = edits.hiddenWings ?? [];
  return hidden.includes(wing) ? edits : { ...edits, hiddenWings: [...hidden, wing] };
}

/** The model with the wings the GM hid. */
export function applyDungeonEdits(model: DungeonModel, edits: DungeonEdits): DungeonModel {
  const rooms = new Set(model.rooms.map((room) => room.id));
  const hiddenWings = (edits.hiddenWings ?? []).filter((wing) => rooms.has(wing));
  return hiddenWings.length > 0 ? { ...model, hiddenWings } : model;
}
