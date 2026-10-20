/**
 * Whether a formula a rule names can be rolled: `@field` stands for a statblock's whole number,
 * which the rest puts in before the formula is read. The editor puts 1 in every field's place
 * through the engine's own substitution (`fillFormula`), so the GM sees a typo before the rest is
 * taken, and a formula the rest reads (`@level d6`) is never refused. Pure.
 */

import { fillFormula } from '../recoveryFormula';

/** Whether `formula` reads as dice and numbers once its fields hold numbers, as the rest reads it. */
export function formulaReads(formula: string): boolean {
  const text = formula.trim();
  return text !== '' && fillFormula(text, () => 1).ok;
}

/** The formula with `@key` put in at `caret` (or at its end), with the spaces a sum needs around it. */
export function withFieldReference(formula: string, key: string, caret: number = formula.length): { text: string; caret: number } {
  const before = formula.slice(0, caret).trimEnd();
  const after = formula.slice(caret).trimStart();
  const joint = before === '' || /[+\-*/(]$/.test(before) ? '' : '+';
  const inserted = `${before}${joint}@${key}`;
  return { text: `${inserted}${after === '' || /^[+\-*/)]/.test(after) ? '' : '+'}${after}`, caret: inserted.length };
}
