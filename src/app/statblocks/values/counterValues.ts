/**
 * A Counters field's value: rows of limited uses (a level's spell slots, ki, a
 * feature's uses per day), each `{ name, max, used, reset, regain }` in the
 * note, where `reset` names one of the refills the template gives the whole
 * sheet and `regain` the dice formula of how many uses it gives back (unset:
 * all). Read strictly: a row that is no counter, names a refill the template
 * does not define or regains no formula Atlas rolls makes the whole value a
 * misfit, shown as it is written, and nothing is clamped. Changes keep every
 * other key of a row. Pure: no React, no Obsidian.
 */

import type { CounterRefill } from '../../online/protocol/sheetCounters';
import type { FieldValue, StatblockTemplate, TemplateField } from '../model/templateTypes';
import { isRegainFormula } from './counterRegain';
import { isPlainRecord } from './fieldValueOf';

/** One row as the card draws it, and its place in the stored list. */
export interface CounterRow {
  name: string;
  max: number;
  used: number;
  /** The name of the refill that gives the row's uses back, as the note writes it; null for none. */
  reset: string | null;
  /** The dice formula of how many uses come back then, as the note writes it; null for all of them. */
  regain: string | null;
}

/** The names of the refills a template defines, which a row's `reset` must be one of. */
export type KnownRefills = ReadonlySet<string>;

const isWhole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** An optional text of a row: null where it is absent, undefined where it is no text. */
function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

/**
 * The refills a template defines for its whole sheet, in template order: each named once (a later
 * one of the same name is left out), bringing along only other refills the template defines.
 */
export function templateRefills(template: Pick<StatblockTemplate, 'refills'>): CounterRefill[] {
  const defined = (template.refills ?? []).filter((refill, index, all) => all.findIndex((other) => other.name === refill.name) === index);
  const names = new Set(defined.map((refill) => refill.name));
  return defined.map((refill) => ({
    name: refill.name,
    includes: [...new Set(refill.includes ?? [])].filter((other) => other !== refill.name && names.has(other)),
  }));
}

/** The names of a template's refills. */
export function knownRefills(template: Pick<StatblockTemplate, 'refills'>): KnownRefills {
  return new Set(templateRefills(template).map((refill) => refill.name));
}

/**
 * One stored row, or null where it is none: a name, a whole maximum, as many used as that at most
 * (missing: none), a refill and a regained formula that are text where it has them. Their names and
 * formulas are taken as written: `readCounterRows` checks them against the template.
 */
export function readCounterRow(value: unknown): CounterRow | null {
  if (!isPlainRecord(value) || typeof value.name !== 'string' || !isWhole(value.max)) return null;
  const used = value.used ?? 0;
  const reset = optionalText(value.reset);
  const regain = optionalText(value.regain);
  if (!isWhole(used) || used > value.max || reset === undefined || regain === undefined) return null;
  return { name: value.name, max: value.max, used, reset, regain };
}

/** Whether a row names only a refill the template defines and regains a formula Atlas rolls. */
function fitsTemplate(row: CounterRow, refills: KnownRefills): boolean {
  return (row.reset === null || refills.has(row.reset)) && (row.regain === null || isRegainFormula(row.regain));
}

/** Every row of a stored value, or null where the value is no list of counters of the template: a row that is none, or names what the template does not define. */
export function readCounterRows(value: FieldValue | undefined, refills: KnownRefills): CounterRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map(readCounterRow);
  return rows.every((row): row is CounterRow => row !== null && fitsTemplate(row, refills)) ? rows : null;
}

/**
 * The rows a statblock of the field starts with, none used. A refill the template does not define, or a
 * regained count that is no formula, reads as none (the template reports it), so a note never stores it.
 */
export function presetCounterRows(field: Pick<TemplateField, 'counterRows'>, refills: KnownRefills): CounterRow[] {
  return (field.counterRows ?? []).map((row) => ({
    name: row.name,
    max: row.max,
    used: 0,
    reset: row.reset !== undefined && refills.has(row.reset) ? row.reset : null,
    regain: row.regain !== undefined && isRegainFormula(row.regain) ? row.regain : null,
  }));
}

/** The preset rows as a statblock that holds none stores them once it changes one; undefined where the template gives none. */
export function startCountersValue(field: Pick<TemplateField, 'counterRows'>, refills: KnownRefills): FieldValue | undefined {
  const rows = presetCounterRows(field, refills);
  return rows.length > 0 ? rows.map((row) => storedRow(row)) : undefined;
}

function isUnset(value: FieldValue | undefined): boolean {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
}

/** The rows the card shows: the note's, else the template's preset rows where the note holds none; null where the note's value is no list of counters of the template. */
export function shownCounterRows(field: Pick<TemplateField, 'counterRows'>, value: FieldValue | undefined, refills: KnownRefills): CounterRow[] | null {
  return isUnset(value) ? presetCounterRows(field, refills) : readCounterRows(value, refills);
}

/** Whether a row is drawn: one with no uses (a spell level not reached yet) is not. */
export function isDrawnCounter(row: CounterRow): boolean {
  return row.max > 0;
}

/** The keys a stored row's counter is read from; any other key of a row is the note's own. */
export const COUNTER_ROW_KEYS: ReadonlySet<string> = new Set(['name', 'max', 'used', 'reset', 'regain']);

/** A row as it is stored: name, maximum, used, its refill and what it regains, in that order, then whatever else the note's row held. */
function storedRow(row: CounterRow, kept: Record<string, FieldValue> = {}): FieldValue {
  const rest = Object.entries(kept).filter(([key]) => !COUNTER_ROW_KEYS.has(key));
  return {
    name: row.name, max: row.max, used: row.used,
    ...(row.reset !== null && { reset: row.reset }), ...(row.regain !== null && { regain: row.regain }),
    ...Object.fromEntries(rest),
  };
}

/** The stored list with each row passed through `change`; the note's own rows where it has them, else the preset rows. */
function changedRows(field: Pick<TemplateField, 'counterRows'>, value: FieldValue | undefined, refills: KnownRefills, change: (row: CounterRow, index: number) => CounterRow): FieldValue | null {
  const rows = shownCounterRows(field, value, refills);
  if (!rows) return null;
  const stored = Array.isArray(value) ? value : [];
  return rows.map((row, index) => {
    const own = stored[index];
    return storedRow(change(row, index), isPlainRecord(own) ? own : {});
  });
}

/** The value with row `index` at `used` uses (kept within 0 and its maximum); null where the value is no list of counters or holds no such row. */
export function withCounterUsed(field: Pick<TemplateField, 'counterRows'>, value: FieldValue | undefined, refills: KnownRefills, index: number, used: number): FieldValue | null {
  const rows = shownCounterRows(field, value, refills);
  const row = rows?.[index];
  if (!row) return null;
  const next = Math.max(0, Math.min(row.max, Math.round(used)));
  if (next === row.used) return null;
  return changedRows(field, value, refills, (each, at) => (at === index ? { ...each, used: next } : each));
}

/**
 * The value with each row at the uses `uses` names for it, in the stored order; null where the value is no list
 * of counters or `uses` names another number of rows. Uses are taken as given: the caller checks them.
 */
export function withCountersUsed(field: Pick<TemplateField, 'counterRows'>, value: FieldValue | undefined, refills: KnownRefills, uses: readonly number[]): FieldValue | null {
  const rows = shownCounterRows(field, value, refills);
  if (!rows || rows.length !== uses.length) return null;
  return changedRows(field, value, refills, (row, index) => ({ ...row, used: uses[index] ?? row.used }));
}
