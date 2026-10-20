/**
 * Turns of a fight by sides, without the store: the sides act in turns, one side or several at
 * once (equal rolls), in the fight's order or this round's rolled order.
 */

import { isBuiltInSide } from '../gameSystems/initiativeSideRules';
import type { SideId } from '../types/initiativeRulesTypes';
import type { InitiativeEntry, InitiativeState, SidesFight } from '../types/initiativeTypes';
import { actsInTurn, backToRoundBefore, beginRound, canStillAct } from './rounds';
import { enterSideRound, fightSideIds, roundTurns } from './sideOrder';

/** How a fight by sides reads its combatants: the side each fights on, and who is defeated. */
export interface SideTurnInputs {
  sideOf: (entry: InitiativeEntry) => SideId;
  defeated: ReadonlySet<string>;
  /** A roll for every side, rolled before the write: taken by a round that begins without rolls of its own. */
  fresh?: Record<SideId, number>;
}

/**
 * Whether a side takes its turn: the players or the opponents without combatants in the tracker
 * always do (the GM may track only one side), a named side without combatants never, and a side
 * with combatants only while one of them `acts`.
 */
function sideActs(initiative: InitiativeState, side: SideId, inputs: SideTurnInputs, acts = actsInTurn): boolean {
  const members = initiative.entries.filter((entry) => inputs.sideOf(entry) === side);
  return members.length === 0 ? isBuiltInSide(side) : members.some((entry) => acts(entry, inputs.defeated));
}

function turnActs(initiative: InitiativeState, turn: readonly SideId[], inputs: SideTurnInputs): boolean {
  return turn.some((side) => sideActs(initiative, side, inputs));
}

/** Whether some side can take a turn in some round: marks clear when a round begins, defeats do not. */
function someSideCanAct(initiative: InitiativeState, fight: SidesFight, inputs: SideTurnInputs): boolean {
  return fightSideIds(fight).some((side) => sideActs(initiative, side, inputs, canStillAct));
}

function turnIndex(initiative: InitiativeState, fight: SidesFight): number {
  return roundTurns(fight, initiative.round).findIndex((turn) => turn.includes(fight.active));
}

/** One step: the next turn of the round; after the last a new round begins with its first. */
function stepForward(initiative: InitiativeState, fight: SidesFight, inputs: SideTurnInputs): SideId[] {
  const turns = roundTurns(fight, initiative.round);
  const next = turns[turnIndex(initiative, fight) + 1];
  if (next) {
    fight.active = next[0]!;
    return next;
  }
  beginRound(initiative);
  enterSideRound(fight, initiative.round, inputs.fresh);
  const first = roundTurns(fight, initiative.round)[0] ?? [fight.first];
  fight.active = first[0]!;
  return first;
}

/** The turns two rounds can hold: within two rounds every mark has cleared once. */
function stepLimit(fight: SidesFight): number {
  return 2 * fightSideIds(fight).length + 1;
}

/**
 * The next turn that acts; a turn whose sides' combatants are all defeated or sit the round out
 * is passed by. Nothing moves while no side can act in any round.
 */
export function nextSideTurn(initiative: InitiativeState, inputs: SideTurnInputs): void {
  const fight = initiative.sides;
  if (!fight || !someSideCanAct(initiative, fight, inputs)) return;
  for (let step = 0; step < stepLimit(fight); step++) {
    if (turnActs(initiative, stepForward(initiative, fight, inputs), inputs)) return;
  }
}

/**
 * The turn before that acted, passing by turns nobody acts in; back over a round's start into the
 * round before, with its rolls. Nothing before the first turn of round 1, and nothing moves while
 * no side can act.
 */
export function previousSideTurn(initiative: InitiativeState, inputs: SideTurnInputs): void {
  const fight = initiative.sides;
  if (!fight || !someSideCanAct(initiative, fight, inputs)) return;
  for (let step = 0; step < stepLimit(fight); step++) {
    const index = turnIndex(initiative, fight);
    let turn: SideId[] | undefined;
    if (index > 0) {
      turn = roundTurns(fight, initiative.round)[index - 1];
    } else if (initiative.round > 1) {
      backToRoundBefore(initiative);
      turn = roundTurns(fight, initiative.round).at(-1);
    }
    if (!turn) return;
    fight.active = turn[0]!;
    if (turnActs(initiative, turn, inputs)) return;
  }
}
