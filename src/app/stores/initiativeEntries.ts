import type { TokenEntity } from '../types';
import type { InitiativeEntry } from '../types/initiativeTypes';
import { t } from '../i18n';

/** An entry before the store gives it an id and a place in the order. */
export type NewInitiativeEntry = Omit<InitiativeEntry, 'id' | 'order' | 'isActive'>;

/** The entry of `token`. It holds no resources: the tracker reads those from the token itself. */
export function initiativeEntryForToken(token: TokenEntity): NewInitiativeEntry {
  const character = token.kind === 'character' ? token : null;
  return {
    tokenId: token.id,
    name: character ? character.name : t('initiative.token'),
    initiative: 0,
    awaitingInitiative: true,
    initiativeModifier: 0,
    imagePath: token.imagePath,
    isNPC: true,
    ...(character?.statblockPath ? { statblockPath: character.statblockPath } : {}),
  };
}

/** Gives `entry` the number `total`, which ends its wait for one. */
export function setInitiative(entry: InitiativeEntry, total: number): void {
  entry.initiative = total;
  delete entry.awaitingInitiative;
}

/** Whether `entry` has a number of its own yet: one rolled or typed, or any an older version wrote. */
export function hasInitiative(entry: Pick<InitiativeEntry, 'initiative' | 'awaitingInitiative'>): boolean {
  return !entry.awaitingInitiative || entry.initiative !== 0;
}
