/**
 * Whether a Dice value rolls: the whole text one roll by the text-roll rule (`tools/textRolls.ts`),
 * which the dice parser accepts within its limits (`2d8 + 2`, `+4+1`, `(2d6 + 3)`, `3d6kh2`). Every
 * check of a Dice value reads it: the note panel's fit, a player's edit online, a value's
 * `rollFrom`. Pure.
 */

import { writtenRoll } from '../../tools/textRolls';
import { fillReferences } from './fillReferences';
import type { FieldLookup } from './references';

/** Whether a Dice value written without references rolls as a whole. */
export function isDiceValue(text: string): boolean {
  return writtenRoll(text) !== null;
}

/**
 * Whether a Dice value rolls once its `@` references are filled in by `lookup` (`1d8 + @str`): every
 * one must name a number, and the filled text must roll. The value itself keeps its references.
 */
export function rollsWithReferences(text: string, lookup: FieldLookup): boolean {
  const filled = fillReferences(text, lookup);
  return filled.unresolved.length === 0 && isDiceValue(filled.text);
}
