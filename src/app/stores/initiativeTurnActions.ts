/**
 * The actions that run a fight: who has the turn, rounds, sitting a round out, delaying.
 * Spread into the initiative actions (`createInitiativeActions`).
 */

import type { TokenEntity } from '../types';
import type { InitiativeState } from '../types/initiativeTypes';
import type { InitiativeRules } from '../types/initiativeRulesTypes';
import { clearSittingOut } from '../initiative/rounds';
import { sideOf } from '../initiative/sides';
import { nextSideTurn, previousSideTurn, type SideTurnInputs } from '../initiative/turns';
import { actNow, delayTurn, endDelays, firstTurn, nextOrderTurn, previousOrderTurn } from '../initiative/turnOrder';

/** Entry ids whose combatant is defeated (the card's skull): turns pass them by. */
export type DefeatedCombatants = ReadonlySet<string>;

export interface InitiativeTurnActions {
  /** The next combatant (or side) that acts takes the turn; the `defeated` are passed by. */
  nextTurn: (defeated?: DefeatedCombatants) => void;
  /** The combatant (or side) before that acts takes the turn back; the `defeated` are passed by. */
  previousTurn: (defeated?: DefeatedCombatants) => void;
  /** Starts a fight as `rules` say (in turn order when left out); it keeps that mode until it ends. */
  startCombat: (rules?: InitiativeRules, defeated?: DefeatedCombatants) => void;
  endCombat: () => void;
  /** Whether a combatant sits the running round out. */
  setInitiativeSitsOut: (id: string, sitsOut: boolean) => void;
  /** The combatant delays its turn and waits outside the order (turn order). */
  delayInitiativeTurn: (id: string, defeated?: DefeatedCombatants) => void;
  /** The delayed combatant acts now, before the combatant whose turn it is. */
  actNowInInitiative: (id: string) => void;
}

interface TurnStoreState {
  initiative: InitiativeState;
  objects: { tokens: Record<string, TokenEntity> };
}

type ImmerSet = (fn: (draft: TurnStoreState) => void) => void;

const NOBODY: DefeatedCombatants = new Set();

function sideInputs(draft: TurnStoreState, defeated: DefeatedCombatants): SideTurnInputs {
  return { sideOf: (entry) => sideOf(draft.objects.tokens[entry.tokenId]), defeated };
}

export function createInitiativeTurnActions(set: ImmerSet): InitiativeTurnActions {
  return {
    nextTurn: (defeated = NOBODY) => set((draft) => {
      if (draft.initiative.sides) nextSideTurn(draft.initiative, sideInputs(draft, defeated));
      else nextOrderTurn(draft.initiative, defeated);
    }),

    previousTurn: (defeated = NOBODY) => set((draft) => {
      if (draft.initiative.sides) previousSideTurn(draft.initiative, sideInputs(draft, defeated));
      else previousOrderTurn(draft.initiative, defeated);
    }),

    startCombat: (rules, defeated = NOBODY) => set((draft) => {
      draft.initiative.isActive = true;
      draft.initiative.round = 1;
      draft.initiative.entries.forEach((entry) => { entry.isActive = false; });
      clearSittingOut(draft.initiative);
      endDelays(draft.initiative);

      // By sides the turn belongs to a side, never to one combatant
      if (rules?.mode === 'sides') {
        draft.initiative.sides = { first: rules.firstSide, active: rules.firstSide };
        draft.initiative.currentIndex = -1;
        return;
      }

      delete draft.initiative.sides;
      firstTurn(draft.initiative, defeated);
    }),

    endCombat: () => set((draft) => {
      draft.initiative.isActive = false;
      draft.initiative.round = 0;
      draft.initiative.currentIndex = -1;
      draft.initiative.entries.forEach((entry) => { entry.isActive = false; });
      delete draft.initiative.sides;
      clearSittingOut(draft.initiative);
      endDelays(draft.initiative);
    }),

    setInitiativeSitsOut: (id, sitsOut) => set((draft) => {
      const entry = draft.initiative.entries.find((e) => e.id === id);
      if (!entry) return;
      if (sitsOut) entry.sitsOut = true;
      else delete entry.sitsOut;
    }),

    delayInitiativeTurn: (id, defeated = NOBODY) => set((draft) => {
      delayTurn(draft.initiative, id, defeated);
    }),

    actNowInInitiative: (id) => set((draft) => {
      actNow(draft.initiative, id);
    }),
  };
}
