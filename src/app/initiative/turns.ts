/**
 * Steps of a fight in the initiative tracker that do not depend on the store:
 * the turn of a side, and the roll of a combatant.
 */

import { parseDefaultRoll } from '../gameSystems/diceRules';
import { INITIATIVE_SIDES } from '../gameSystems/initiativeRules';
import type { InitiativeSide } from '../types/initiativeRulesTypes';
import type { InitiativeEntry, InitiativeState } from '../types/initiativeTypes';
import { actsInTurn, backToRoundBefore, beginRound, canStillAct } from './rounds';
import { otherSide } from './sides';

/** How a fight by sides reads its combatants: the side each fights on, and who is defeated. */
export interface SideTurnInputs {
  sideOf: (entry: InitiativeEntry) => InitiativeSide;
  defeated: ReadonlySet<string>;
}

/**
 * Whether a side takes its turn: a side without combatants in the tracker always does (the GM may
 * track only one side), one with combatants only while one of them `acts`.
 */
function sideActs(initiative: InitiativeState, side: InitiativeSide, inputs: SideTurnInputs, acts = actsInTurn): boolean {
  const members = initiative.entries.filter((entry) => inputs.sideOf(entry) === side);
  return members.length === 0 || members.some((entry) => acts(entry, inputs.defeated));
}

/** Whether either side can take a turn in some round: marks clear when a round begins, defeats do not. */
function someSideCanAct(initiative: InitiativeState, inputs: SideTurnInputs): boolean {
  return INITIATIVE_SIDES.some((side) => sideActs(initiative, side, inputs, canStillAct));
}

/** One step: the other side's turn; after the second side a new round begins with the first. */
function stepForward(initiative: InitiativeState, sides: { first: InitiativeSide; active: InitiativeSide }): void {
  if (sides.active === sides.first) {
    sides.active = otherSide(sides.first);
    return;
  }
  sides.active = sides.first;
  beginRound(initiative);
}

/**
 * The next side that acts; a side whose combatants are all defeated or sit the round out is
 * passed by. Nothing moves while no side can act in any round.
 */
export function nextSideTurn(initiative: InitiativeState, inputs: SideTurnInputs): void {
  const { sides } = initiative;
  if (!sides || !someSideCanAct(initiative, inputs)) return;
  // Within two rounds every mark has cleared once, so a side that can act has come
  for (let step = 0; step < 4; step++) {
    stepForward(initiative, sides);
    if (sideActs(initiative, sides.active, inputs)) return;
  }
}

/** The side before that acted, passing by sides nobody of acts in; nothing before the first side of round 1. */
export function previousSideTurn(initiative: InitiativeState, inputs: SideTurnInputs): void {
  const { sides } = initiative;
  if (!sides) return;
  for (let step = 0; step < 4; step++) {
    if (sides.active !== sides.first) {
      sides.active = sides.first;
    } else if (initiative.round > 1) {
      sides.active = otherSide(sides.first);
      backToRoundBefore(initiative);
    } else {
      return;
    }
    if (sideActs(initiative, sides.active, inputs)) return;
  }
}

/** The total of a dice group such as `1d20` or `2d6`; a d20 when `roll` is none. */
export function rollInitiativeDice(roll: string, random: () => number): number {
  const { count, sides } = parseDefaultRoll(roll) ?? { count: 1, sides: 20 };
  let total = 0;
  for (let die = 0; die < count; die++) total += Math.floor(random() * sides) + 1;
  return total;
}
