import { currentTurn, inFight, turnEntries } from '../../initiative/turnHolders';
import type { TokenEntity } from '../../types';
import type { InitiativeState } from '../../types/initiativeTypes';

/** What the turn's share reads of a tab's store. */
export interface TurnShareState {
  readonly initiative?: Pick<InitiativeState, 'isActive' | 'round' | 'entries' | 'sides'> | undefined;
  readonly initiativeTrackerOpen?: boolean | undefined;
  readonly objects: { readonly tokens: Readonly<Record<string, TokenEntity>> };
}

/**
 * The GM ids of the tokens players are told hold the turn (the page's turn marker): those of the
 * running fight's turn (`turnEntries`), and none while players are not shown the initiative list
 * (the player view's switch off, or the GM's tracker closed). Which of them a player is sent at all
 * is the token list's business: only tokens they see.
 */
export function sharedTurnTokens(state: TurnShareState, showInitiative: boolean): ReadonlySet<string> {
  if (!showInitiative || state.initiativeTrackerOpen !== true || !state.initiative) return new Set();
  return new Set(turnEntries(currentTurn(state.initiative), state.initiative, state.objects.tokens).map((entry) => entry.tokenId));
}

/**
 * Whether a player's move of `tokenId` is refused for being out of turn: the GM chose that players
 * move only on their turn (`movesOnTurn`), a fight runs, the token fights in it and does not hold
 * the turn (by sides: its side does not). A token outside the fight moves freely.
 */
export function movesOutOfTurn(state: TurnShareState, movesOnTurn: boolean, tokenId: string): boolean {
  const initiative = state.initiative;
  if (!movesOnTurn || !initiative?.isActive || !inFight(initiative, tokenId)) return false;
  return !turnEntries(currentTurn(initiative), initiative, state.objects.tokens).some((entry) => entry.tokenId === tokenId);
}
