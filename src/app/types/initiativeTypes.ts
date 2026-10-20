/**
 * Initiative Tracker Types
 * Baldur's Gate 3-inspired initiative system for combat tracking
 */

import type { InitiativeSide } from './initiativeRulesTypes';

/**
 * Configuration for the initiative tracker
 */
export interface InitiativeConfig {
  /** Whether to auto-sort entries by initiative value after rolling */
  autoSort: boolean;
}

/**
 * A single entry in the initiative tracker
 */
export interface InitiativeEntry {
  /** Unique identifier for this entry */
  id: string;

  /** Reference to the token on the map */
  tokenId: string;

  /** Display name */
  name: string;

  /** Rolled initiative value (after modifiers) */
  initiative: number;

  /**
   * The GM's own modifier, added to every roll (`ownModifier`). Every version writes it, 0 where
   * there is none, and older ones add it to their rolls.
   */
  initiativeModifier: number;

  /** `initiativeModifier` was set in the edit popup, so a 0 there is the GM's too; `undefined` clears it when patched. */
  modifierByHand?: true | undefined;

  /** Path to token image for avatar display */
  imagePath: string;

  /** Path to linked statblock note (for CMD+hover preview); `undefined` clears it when patched */
  statblockPath?: string | undefined;

  /** Whether this entry has the current turn */
  isActive: boolean;

  /** Whether this is an NPC (vs player character) */
  isNPC: boolean;

  /** Order in the initiative list (for manual reordering) */
  order: number;

  /** Does not act in the running round (Cairn: a failed DEX save in round 1); cleared when the round ends. */
  sitsOut?: boolean;

  /**
   * Delayed its turn in a fight in turn order: it waits outside the order, and turns pass it by,
   * until it acts again (`actNow`). Older versions read the entry at its place.
   */
  delayed?: true;

  /**
   * The modifier the last roll added (the GM's own, else the statblock's). It only breaks ties
   * between equal totals and is never added to a roll; older versions ignore it.
   */
  rolledModifier?: number;

  /**
   * Set by Act Now: the tie-break of the combatant it acted before, with whose number it ties, so
   * that a later sort keeps it right before that one. A roll or an edit of its own number or
   * modifier clears it; older versions ignore it.
   */
  tieBreak?: number;
}

/**
 * Full state for the initiative tracker
 */
export interface InitiativeState {
  /** All entries in the initiative order */
  entries: InitiativeEntry[];

  /** Index of the currently active entry */
  currentIndex: number;

  /** Current combat round number */
  round: number;

  /** Whether combat is currently active */
  isActive: boolean;

  /** Configuration for initiative calculation */
  config: InitiativeConfig;

  /**
   * Set while a fight runs by sides: the side that acts first in a round and the one whose
   * turn it is. A fight keeps the mode it was started in, whatever the collection's rules say since.
   */
  sides?: { first: InitiativeSide; active: InitiativeSide };

  /**
   * The combatants each round's start cleared `sitsOut` of, by that round, so that stepping back
   * over the start puts their marks back. Only rounds that cleared something are kept.
   */
  satOut?: Record<string, string[]>;
}

/**
 * Default configuration for initiative
 */
export const DEFAULT_INITIATIVE_CONFIG: InitiativeConfig = {
  autoSort: true,
};

/**
 * Default empty initiative state
 */
export const createDefaultInitiativeState = (): InitiativeState => ({
  entries: [],
  currentIndex: -1,
  round: 0,
  isActive: false,
  config: { ...DEFAULT_INITIATIVE_CONFIG },
});
