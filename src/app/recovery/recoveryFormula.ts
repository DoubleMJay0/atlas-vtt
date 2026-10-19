/**
 * A recovery formula with the statblock's numbers put in (`1d4+@tier`, `@level d6`), checked as
 * Atlas's dice parser reads it, and worked out where it holds no dice. `@field` names a dotted path
 * of the note (`@level`, `@abilities.con`) and takes only a whole number: bare where it stands as a
 * dice count (`@level d6`, `@leveld6` become `3d6`), in parentheses everywhere else so a negative
 * number parses (`1d8+@con` becomes `1d8+(-1)`). Nothing inside a `[label]` is read. The limits of
 * a formula are checked again once the numbers are in. Pure.
 */

import { evaluateFormula } from '../tools/evaluateFormula';
import { parseFormula, type FormulaErrorCode, type ParsedFormula } from '../tools/parseFormula';

/** Why a formula cannot be used; `field` names the `@field` at fault where there is one. */
export type FormulaProblem =
  | { readonly kind: 'missing'; readonly field: string }
  | { readonly kind: 'not-whole'; readonly field: string }
  | { readonly kind: 'limits'; readonly field: string | null }
  | { readonly kind: 'syntax' };

/** A formula ready to use: as rolled (`3d6+(2)`), parsed, and whether it holds dice. */
export interface FilledFormula {
  readonly ok: true;
  readonly formula: string;
  readonly parsed: ParsedFormula;
  readonly dice: boolean;
}

export type FormulaFill = FilledFormula | { readonly ok: false; readonly problem: FormulaProblem };

/** Reads the note's value at a dotted path; undefined where it holds none. */
export type FieldLookup = (path: string) => unknown;

/** The largest constant and dice count the parser reads (`\d{1,4}` and `\d{0,3}`). */
const MAX_CONSTANT = 9999;
const MAX_DICE_COUNT = 999;
const LIMIT_CODES: ReadonlySet<FormulaErrorCode> = new Set(['length', 'terms', 'dice', 'faces', 'depth', 'total', 'modifier']);

const REFERENCE = /@([A-Za-z_]\w*(?:\.\w+)*)/y;
/** What makes the text after a number a dice term: `d6`, `d%`, `dF`, after spaces or none. */
const DICE_AFTER = /^[ \t]*[dD](?:\d|%|[fF])/;
const SPACES = /^[ \t]*/;

/** A whole number a field holds: a whole number, or a text that writes one (`+2`, `-1`); undefined otherwise. */
export function wholeNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : undefined;
  if (typeof value !== 'string' || !/^\s*[+-]?\d{1,15}\s*$/.test(value)) return undefined;
  return Number(value.trim());
}

interface Reference {
  /** The path read, as written up to where its number stands. */
  field: string;
  value: unknown;
  /** Where the text goes on after the reference. */
  end: number;
}

/**
 * The reference at `at` (just past the `@`): the whole path where the note holds it, else the
 * longest part of it before a `d` that starts a dice term (`leveld6` is `level` before `d6`).
 */
function readReference(text: string, at: number, lookup: FieldLookup): Reference | { missing: string } {
  REFERENCE.lastIndex = at - 1;
  const path = REFERENCE.exec(text)![1]!;
  const end = at + path.length;
  const whole = lookup(path);
  if (whole !== undefined) return { field: path, value: whole, end };
  for (let split = path.length - 1; split > 0; split -= 1) {
    if (path[split] !== 'd' && path[split] !== 'D') continue;
    const field = path.slice(0, split);
    if (!DICE_AFTER.test(text.slice(at + split)) || field.endsWith('.')) continue;
    const value = lookup(field);
    if (value !== undefined) return { field, value, end: at + split };
  }
  return { missing: path };
}

type Substitution = { ok: true; text: string; fields: string[] } | { ok: false; problem: FormulaProblem };

/** The formula with every `@field` outside a label put in, or the field that cannot be. */
function substitute(formula: string, lookup: FieldLookup): Substitution {
  let text = '';
  const fields: string[] = [];
  let cursor = 0;
  while (cursor < formula.length) {
    const character = formula[cursor]!;
    if (character === '[') {
      const close = formula.indexOf(']', cursor);
      const end = close < 0 ? formula.length : close + 1;
      text += formula.slice(cursor, end);
      cursor = end;
      continue;
    }
    REFERENCE.lastIndex = cursor;
    if (character !== '@' || !REFERENCE.test(formula)) {
      text += character;
      cursor += 1;
      continue;
    }
    const reference = readReference(formula, cursor + 1, lookup);
    if ('missing' in reference) return { ok: false, problem: { kind: 'missing', field: reference.missing } };
    const value = wholeNumber(reference.value);
    if (value === undefined) return { ok: false, problem: { kind: 'not-whole', field: reference.field } };
    const rest = formula.slice(reference.end);
    const count = DICE_AFTER.test(rest);
    if (count ? value < 0 || value > MAX_DICE_COUNT : Math.abs(value) > MAX_CONSTANT) {
      return { ok: false, problem: { kind: 'limits', field: reference.field } };
    }
    fields.push(reference.field);
    text += count ? String(value) : `(${value})`;
    cursor = reference.end + (count ? SPACES.exec(rest)![0].length : 0);
  }
  return { ok: true, text, fields };
}

/** A formula parsed as it is used, or why it cannot be; `fields` names what was put in, for a limit it breaks. */
export function checkedFormula(text: string, fields: readonly string[] = []): FormulaFill {
  const parsed = parseFormula(text);
  if (!parsed.ok) {
    if (!LIMIT_CODES.has(parsed.code)) return { ok: false, problem: { kind: 'syntax' } };
    return { ok: false, problem: { kind: 'limits', field: fields[0] ?? null } };
  }
  return { ok: true, formula: text, parsed, dice: parsed.terms.some((term) => term.kind === 'dice') };
}

/** `formula` with the note's numbers put in (`lookup`), checked; never rolled here. */
export function fillFormula(formula: string, lookup: FieldLookup): FormulaFill {
  const substituted = substitute(formula.trim(), lookup);
  return substituted.ok ? checkedFormula(substituted.text, substituted.fields) : substituted;
}

/** What a formula without dice comes to, worked out exactly and cut towards zero, as a roll of it would. */
export function computeFormula(parsed: ParsedFormula): number {
  return evaluateFormula(parsed.expression, (term) => (term.kind === 'constant' ? term.value : 0));
}
