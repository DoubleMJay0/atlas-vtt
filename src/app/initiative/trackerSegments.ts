import type { TokenEntity } from '../types';
import type { InitiativeEntry } from '../types/initiativeTypes';
import type { InitiativeSide } from '../types/initiativeRulesTypes';
import { COLLAPSED_CARDS } from './initiativeLayout';
import { firstCards, listSegments, type ListSegment } from './listSegments';
import { sideOf, sidesInOrder } from './sides';

/** What the GM's tracker draws its list by. */
export interface TrackerListOptions {
  bySides: boolean;
  firstSide: InitiativeSide;
  activeSide: InitiativeSide | undefined;
  fightRuns: boolean;
  round: number;
  /** The GM's choice: the list starts at the turn during a fight. */
  fromTurn: boolean;
  /** Only the turn and the next combatants, which start at the turn whatever `fromTurn` says. */
  collapsed: boolean;
}

/**
 * The GM's tracker list (`listSegments`) of `entries` in turn order: every side, also one
 * without combatants; in turn order the list turns at the combatant whose turn it is.
 */
export function trackerSegments(
  entries: readonly InitiativeEntry[],
  tokens: Readonly<Record<string, TokenEntity>>,
  options: TrackerListOptions,
): ListSegment<InitiativeEntry>[] {
  const segments = listSegments(entries, {
    bySides: options.bySides,
    sides: sidesInOrder(options.firstSide),
    sideOf: (entry) => sideOf(tokens[entry.tokenId]),
    delayed: (entry) => entry.delayed === true,
    fightRuns: options.fightRuns,
    round: options.round,
    activeSide: options.activeSide,
    turnAt: entries.filter((entry) => !entry.delayed).findIndex((entry) => entry.isActive),
    fromTurn: options.fromTurn || options.collapsed,
    emptySides: true,
  });
  return options.collapsed ? firstCards(segments, COLLAPSED_CARDS) : segments;
}
