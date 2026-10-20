/**
 * The order of a fight in turn order: the higher total first, of equal totals the higher modifier,
 * and of equal modifiers the order the combatants had, which the GM settles by dragging.
 */

import type { InitiativeEntry, InitiativeState } from '../types/initiativeTypes';
import { ownModifier } from './initiativeModifier';
import { renumber } from './turnOrder';

/** What breaks a tie: the GM's own modifier, else what the last roll added, else nothing. */
export function tieBreakModifier(entry: InitiativeEntry): number {
  return ownModifier(entry) ?? entry.rolledModifier ?? 0;
}

/** Compares two combatants by total, then modifier; 0 keeps their order (the sort is stable). */
export function byInitiative(a: InitiativeEntry, b: InitiativeEntry): number {
  return b.initiative - a.initiative || tieBreakModifier(b) - tieBreakModifier(a);
}

/** Sorts the combatants into turn order; the turn stays with the combatant that has it. */
export function sortCombatants(initiative: InitiativeState): void {
  initiative.entries.sort(byInitiative);
  renumber(initiative.entries);
  const active = initiative.entries.findIndex((entry) => entry.isActive);
  if (active !== -1) initiative.currentIndex = active;
}
