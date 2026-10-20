import { useCallback, useState } from 'react';
import type { InitiativeEntry } from '../../types/initiativeTypes';
import { totalEdit } from '../../initiative/initiativeEdit';
import type { NumberStep } from './InitiativeNumber';

/** Which card's number is being typed, and what the cards call while it is. */
export interface NumberEditing {
  editingId: string | null;
  start: (entry: InitiativeEntry) => void;
  commit: (entry: InitiativeEntry, text: string, step: NumberStep) => void;
  cancel: () => void;
}

/**
 * Typing the combatants' numbers on their cards, one card at a time. A commit writes the number
 * as the edit popup does (`totalEdit`); Tab and Shift+Tab then go on to the card after or before it
 * in `entries` as they stood when the key was pressed, so a list that sorts itself anew after every
 * number still has each card typed once, in the order the GM saw.
 */
export function useNumberEditing(
  entries: readonly InitiativeEntry[],
  update: (id: string, changes: Partial<InitiativeEntry>) => void,
): NumberEditing {
  const [editingId, setEditingId] = useState<string | null>(null);

  const commit = useCallback((entry: InitiativeEntry, text: string, step: NumberStep): void => {
    const index = entries.findIndex((candidate) => candidate.id === entry.id);
    const next = step === 0 || index < 0 ? undefined : entries[index + step];
    const changes = totalEdit(text);
    if (changes.initiative !== undefined) update(entry.id, changes);
    setEditingId(next?.id ?? null);
  }, [entries, update]);

  const start = useCallback((entry: InitiativeEntry): void => setEditingId(entry.id), []);
  const cancel = useCallback((): void => setEditingId(null), []);

  return { editingId, start, commit, cancel };
}
