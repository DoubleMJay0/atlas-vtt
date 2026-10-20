/**
 * Whether a formula a rule names can be rolled: `@field` stands for a statblock's whole number,
 * which the rest puts in before the formula is read (`recoveryFormula.ts` of the engine). The
 * editor reads it with 1 in every field's place, so the GM sees a typo before the rest is taken.
 * Pure.
 */

import { parseFormula } from '../../tools/parseFormula';
import { FORMULA_LIMITS } from '../../tools/formulaTypes';

/** A field a formula names: `@level`, `@abilities.con`. */
const FIELD_REFERENCE = /@([A-Za-z_][\w-]*(?:\.[\w-]+)*)/g;

/** The fields a formula names, each once, in order. */
export function formulaFields(formula: string): string[] {
  return [...new Set([...formula.matchAll(FIELD_REFERENCE)].map((match) => match[1]!))];
}

/** Whether `formula` reads as dice and numbers once its fields hold numbers. */
export function formulaReads(formula: string): boolean {
  const text = formula.trim();
  if (text === '' || text.length > FORMULA_LIMITS.characters) return false;
  return parseFormula(text.replace(FIELD_REFERENCE, '1')).ok;
}

/** The formula with `@key` put in at `caret` (or at its end), with the spaces a sum needs around it. */
export function withFieldReference(formula: string, key: string, caret: number = formula.length): { text: string; caret: number } {
  const before = formula.slice(0, caret).trimEnd();
  const after = formula.slice(caret).trimStart();
  const joint = before === '' || /[+\-*/(]$/.test(before) ? '' : '+';
  const inserted = `${before}${joint}@${key}`;
  return { text: `${inserted}${after === '' || /^[+\-*/)]/.test(after) ? '' : '+'}${after}`, caret: inserted.length };
}
