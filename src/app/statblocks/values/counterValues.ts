/**
 * A Counters field's value: rows of limited uses (a level's spell slots, ki, a
 * feature's uses per day), each `{ name, max, used, reset }` in the note. Read
 * strictly: a row that is no counter makes the whole value a misfit, shown as
 * it is written, and nothing is clamped. Changes keep every other key of a row.
 * Pure: no React, no Obsidian.
 */

import { COUNTER_RESETS, type CounterReset, type FieldValue, type TemplateField } from '../model/templateTypes';
import { isPlainRecord } from './fieldValueOf';

/** One row as the card draws it, and its place in the stored list. */
export interface CounterRow {
  name: string;
  max: number;
  used: number;
  reset: CounterReset | null;
}

/** The rest a rest button stands for. */
export type CounterRest = CounterReset;

const isWhole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

function asReset(value: unknown): CounterReset | null | undefined {
  if (value === undefined || value === null) return null;
  return COUNTER_RESETS.find((reset) => reset === value);
}

/** One stored row, or null where it is none: a name, a whole maximum, as many used as that at most (missing: none). */
export function readCounterRow(value: unknown): CounterRow | null {
  if (!isPlainRecord(value) || typeof value.name !== 'string' || !isWhole(value.max)) return null;
  const used = value.used ?? 0;
  const reset = asReset(value.reset);
  if (!isWhole(used) || used > value.max || reset === undefined) return null;
  return { name: value.name, max: value.max, used, reset };
}

/** Every row of a stored value, or null where the value is no list of counters. */
export function readCounterRows(value: FieldValue | undefined): CounterRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map(readCounterRow);
  return rows.every((row) => row !== null) ? rows : null;
}

/** The rows a statblock of the field starts with, none used. */
export function presetCounterRows(field: Pick<TemplateField, 'counterRows'>): CounterRow[] {
  return (field.counterRows ?? []).map((row) => ({ name: row.name, max: row.max, used: 0, reset: row.reset ?? null }));
}

function isUnset(value: FieldValue | undefined): boolean {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
}

/** The rows the card shows: the note's, else the template's preset rows where the note holds none; null where the note's value is no list of counters. */
export function shownCounterRows(field: Pick<TemplateField, 'counterRows'>, value: FieldValue | undefined): CounterRow[] | null {
  return isUnset(value) ? presetCounterRows(field) : readCounterRows(value);
}

/** Whether a row is drawn: one with no uses (a spell level not reached yet) is not. */
export function isDrawnCounter(row: CounterRow): boolean {
  return row.max > 0;
}

const ROW_KEYS: ReadonlySet<string> = new Set(['name', 'max', 'used', 'reset']);

/** A row as it is stored: name, maximum, used and its rest, in that order, then whatever else the note's row held. */
function storedRow(row: CounterRow, kept: Record<string, FieldValue> = {}): FieldValue {
  const rest = Object.entries(kept).filter(([key]) => !ROW_KEYS.has(key));
  return { name: row.name, max: row.max, used: row.used, ...(row.reset !== null && { reset: row.reset }), ...Object.fromEntries(rest) };
}


/** The stored list with each row passed through `change`; the note's own rows where it has them, else the preset rows. */
function changedRows(field: Pick<TemplateField, 'counterRows'>, value: FieldValue | undefined, change: (row: CounterRow, index: number) => CounterRow): FieldValue | null {
  const rows = shownCounterRows(field, value);
  if (!rows) return null;
  const stored = Array.isArray(value) ? value : [];
  return rows.map((row, index) => {
    const own = stored[index];
    return storedRow(change(row, index), isPlainRecord(own) ? own : {});
  });
}

/** The value with row `index` at `used` uses (kept within 0 and its maximum); null where the value is no list of counters or holds no such row. */
export function withCounterUsed(field: Pick<TemplateField, 'counterRows'>, value: FieldValue | undefined, index: number, used: number): FieldValue | null {
  const rows = shownCounterRows(field, value);
  const row = rows?.[index];
  if (!row) return null;
  const next = Math.max(0, Math.min(row.max, Math.round(used)));
  if (next === row.used) return null;
  return changedRows(field, value, (each, at) => (at === index ? { ...each, used: next } : each));
}

/** Whether a rest gives a row's uses back: a short rest its short-rest rows, a long rest those and its long-rest rows. */
export function restRefills(rest: CounterRest, reset: CounterReset | null): boolean {
  if (reset === null) return false;
  return rest === 'long-rest' || reset === 'short-rest';
}

/** The value after `rest`, or null where it gives nothing back (or the value is no list of counters). */
export function afterCounterRest(field: Pick<TemplateField, 'counterRows'>, value: FieldValue | undefined, rest: CounterRest): FieldValue | null {
  const rows = shownCounterRows(field, value);
  if (!rows?.some((row) => row.used > 0 && restRefills(rest, row.reset))) return null;
  return changedRows(field, value, (row) => (restRefills(rest, row.reset) ? { ...row, used: 0 } : row));
}

/** The rests whose button the block shows: those that would refill one of the drawn rows. */
export function countersRests(rows: readonly CounterRow[]): CounterRest[] {
  const drawn = rows.filter(isDrawnCounter);
  return COUNTER_RESETS.filter((rest) => drawn.some((row) => restRefills(rest, row.reset)));
}
