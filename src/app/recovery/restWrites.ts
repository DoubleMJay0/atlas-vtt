/**
 * Writing what a rest changed, the way the GM's own edits are written: a resource on the token it
 * was read from (one undo step per map, which `PartyReconciler` carries to the played campaign's
 * values) or else into those values (no undo step); a condition on every token of the character
 * on an open map; counters into the note through the note writer, one patch per field with the
 * value the rest read as its base. The map's steps and the note's history stay separate.
 */

import type { App } from 'obsidian';
import { writeCharacterValue } from '../online/gm/book/characterValues';
import { resourceUpdate } from '../resources/resourceValues';
import { runHistoryTransaction } from '../stores/history';
import type { ViewAtlasStore } from '../storeFactory';
import { fieldPatches } from '../statblocks/editor/statblock-pane/valuePatches';
import type { FieldValue, TemplateField } from '../statblocks/model/templateTypes';
import { NoteFieldWriter } from '../statblocks/notes/NoteFieldWriter';
import type { NotePatch } from '../statblocks/notes/patchTypes';
import { readField } from '../statblocks/values/fieldValues';
import type { TokenUpdates } from '../types/viewState';
import type { CharacterRest } from './characterRest';
import type { RestOutcome } from './restTypes';

/** One Counters field to write: its patches, and the value they start from and lead to. */
export interface CounterWrite {
  readonly field: TemplateField;
  readonly patches: readonly NotePatch[];
  readonly base: FieldValue | undefined;
  readonly next: FieldValue;
}

/** Writes counters into the note; answers why it could not, or null. */
export type CounterWriter = (writes: readonly CounterWrite[]) => Promise<string | null>;

/** The note writer of the app, for the note `notePath`: every field in one write. */
export function noteCounterWriter(app: App, notePath: string): CounterWriter {
  return async (writes) => {
    const outcome = await NoteFieldWriter.forApp(app).write(notePath, writes.flatMap((write) => write.patches));
    return outcome.problem ?? (outcome.conflicts.length > 0 ? 'the note changed meanwhile.' : null);
  };
}

interface StoreWrites {
  resources: Array<{ id: string; changes: TokenUpdates }>;
  conditions: Array<{ tokenIds: string[]; id: string; value: number }>;
}

/** Writes the rest's resources and conditions on the maps and into the campaign's values. */
function writeScene(app: App, rest: CharacterRest, outcome: RestOutcome): void {
  const byStore = new Map<ViewAtlasStore, StoreWrites>();
  const writesOf = (store: ViewAtlasStore): StoreWrites => {
    let writes = byStore.get(store);
    if (!writes) byStore.set(store, writes = { resources: [], conditions: [] });
    return writes;
  };
  for (const [key, value] of outcome.resources) {
    const place = rest.resourcePlace(key);
    if (place?.kind === 'party') {
      writeCharacterValue(app, { kind: 'character', from: '', placed: { assetId: rest.asset.id, imagePath: rest.asset.imagePath }, key, current: value.current });
    } else if (place?.kind === 'token') {
      const token = place.store.getState().objects.tokens[place.tokenId];
      if (token) writesOf(place.store).resources.push({ id: place.tokenId, changes: resourceUpdate(token, key, value, false) });
    }
  }
  for (const [id, value] of outcome.conditions) {
    for (const { store, tokenIds } of rest.holds) writesOf(store).conditions.push({ tokenIds: [...tokenIds], id, value });
  }
  for (const [store, writes] of byStore) {
    runHistoryTransaction(store, () => {
      const state = store.getState();
      if (writes.resources.length > 0) state.updateTokens(writes.resources);
      for (const { tokenIds, id, value } of writes.conditions) state.setTokensConditionValue(tokenIds, id, value > 0 ? value : null);
    });
  }
}

/**
 * Writes everything a rest changed. Counters go through `writeCounters` (the app's note writer
 * unless given); answers why they could not be written, or null.
 */
export async function writeRest(app: App, rest: CharacterRest, outcome: RestOutcome, writeCounters: CounterWriter = noteCounterWriter(app, rest.notePath)): Promise<string | null> {
  writeScene(app, rest, outcome);
  const counters = [...outcome.counters.values()].map(({ field, base, next }): CounterWrite => {
    const read = readField(rest.record, field);
    return { field, base, next, patches: fieldPatches(field.key, { ...read, value: base }, next) };
  });
  return counters.length > 0 ? writeCounters(counters) : null;
}
