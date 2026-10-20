import type { InitiativeState } from '../types/initiativeTypes';
import { byInitiative } from './tieBreak';
import { renumber } from './turnOrder';

/** Sorts the combatants into turn order (`byInitiative`); the turn stays with the combatant that has it. */
export function sortCombatants(initiative: InitiativeState): void {
  initiative.entries.sort(byInitiative);
  renumber(initiative.entries);
  const active = initiative.entries.findIndex((entry) => entry.isActive);
  if (active !== -1) initiative.currentIndex = active;
}
