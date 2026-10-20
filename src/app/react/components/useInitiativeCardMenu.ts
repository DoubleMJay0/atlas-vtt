import type React from 'react';
import { useCallback } from 'react';
import { openContextMenuGlobal } from '../root/ContextMenuContext';
import { useAtlasStore } from '../ViewStoreContext';
import type { TokenEntity } from '../../types';
import type { InitiativeEntry } from '../../types/initiativeTypes';
import { initiativeCardMenu } from './initiativeCardMenu';

interface CardMenuInputs {
  tokens: Readonly<Record<string, TokenEntity>>;
  bySides: boolean;
  fightRuns: boolean;
  /** Rolls one combatant with its statblock's modifier (`useInitiativeRolls`). */
  roll: (entryId: string) => void;
  /** The defeated combatants as their cards show them now; a delay passes the turn by them. */
  defeated: () => ReadonlySet<string>;
  /** Opens the edit popup of `entry` beside its card. */
  edit: (entry: InitiativeEntry, cardElement: HTMLElement) => void;
}

/** Opens the menu of a combatant's card (`initiativeCardMenu`) with the store's actions. */
export function useInitiativeCardMenu(inputs: CardMenuInputs): (event: React.MouseEvent, entry: InitiativeEntry, cardElement: HTMLElement) => void {
  const { tokens, bySides, fightRuns, roll, defeated, edit } = inputs;
  const removeFromInitiative = useAtlasStore((s) => s.removeFromInitiative);
  const moveToFront = useAtlasStore((s) => s.moveToFront);
  const moveToBack = useAtlasStore((s) => s.moveToBack);
  const updateTokens = useAtlasStore((s) => s.updateTokens);
  const setInitiativeSitsOut = useAtlasStore((s) => s.setInitiativeSitsOut);
  const delayInitiativeTurn = useAtlasStore((s) => s.delayInitiativeTurn);
  const actNowInInitiative = useAtlasStore((s) => s.actNowInInitiative);

  return useCallback((event: React.MouseEvent, entry: InitiativeEntry, cardElement: HTMLElement): void => {
    const entries = initiativeCardMenu(entry, tokens[entry.tokenId], { bySides, fightRuns }, {
      roll: () => roll(entry.id),
      moveToFront: () => moveToFront(entry.id),
      moveToBack: () => moveToBack(entry.id),
      edit: () => edit(entry, cardElement),
      updateToken: (changes) => updateTokens([{ id: entry.tokenId, changes }]),
      setSitsOut: (sitsOut) => setInitiativeSitsOut(entry.id, sitsOut),
      delay: () => delayInitiativeTurn(entry.id, defeated()),
      actNow: () => actNowInInitiative(entry.id),
      remove: () => removeFromInitiative(entry.id),
    });
    openContextMenuGlobal(entries, { x: event.clientX, y: event.clientY });
  }, [tokens, bySides, fightRuns, roll, defeated, edit, moveToFront, moveToBack, removeFromInitiative, updateTokens, setInitiativeSitsOut, delayInitiativeTurn, actNowInInitiative]);
}
