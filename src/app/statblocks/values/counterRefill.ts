/**
 * A refill of a whole sheet ("Long rest"): every Counters field's rows that the refill names
 * (`refilledBy`) get their uses back, all of them, or as many as their `regain` formula rolls.
 * Pure: the caller rolls (`RegainRoll`) and writes the fields it answers. The note panel and a
 * player's refill at an online table both go through it, so they give back the same.
 */

import { refilledBy, type CounterRefill } from '../../online/protocol/sheetCounters';
import type { FieldValue, TemplateField } from '../model/templateTypes';
import { usedAfterRegain } from './counterRegain';
import { shownCounterRows, withCountersUsed, type CounterRow, type KnownRefills } from './counterValues';

/** A Counters field and what the note holds of it now. */
export interface RefillTarget {
  readonly field: TemplateField;
  readonly value: FieldValue | undefined;
}

/** A field a refill changes: what it held, and what it holds once its uses are back. */
export interface RefilledField {
  readonly field: TemplateField;
  readonly base: FieldValue | undefined;
  readonly next: FieldValue;
}

/**
 * Rolls a row's regained formula, its roll named `flavor` ("Wand (Dawn)"), and answers the total;
 * null where it cannot be rolled, which refuses the whole refill.
 */
export type RegainRoll = (formula: string, flavor: string) => number | null;

/** The refills the panel offers for a sheet: those that would refill one drawn row of one of its fields, in template order. */
export function offeredRefills(refills: readonly CounterRefill[], targets: readonly RefillTarget[], known: KnownRefills): CounterRefill[] {
  const rows = targets.flatMap(({ field, value }) => (shownCounterRows(field, value, known) ?? []).filter((row) => row.max > 0));
  return refills.filter((refill) => rows.some((row) => refilledBy(refill, row)));
}

/** A field's uses once `refill` is in; null where it gives nothing back, undefined where a roll could not be made. */
function refilledUses(rows: readonly CounterRow[], refill: CounterRefill, roll: RegainRoll): number[] | null | undefined {
  let changed = false;
  const uses: number[] = [];
  for (const row of rows) {
    if (row.used === 0 || !refilledBy(refill, row)) {
      uses.push(row.used);
      continue;
    }
    const rolled = row.regain === null ? null : roll(row.regain, `${row.name} (${refill.name})`);
    if (row.regain !== null && rolled === null) return undefined;
    const used = usedAfterRegain(row.used, rolled);
    changed ||= used !== row.used;
    uses.push(used);
  }
  return changed ? uses : null;
}

/**
 * The fields the refill named `name` changes, in the order given, each with its rows' uses back; an empty
 * list where it gives nothing back. Null where the template defines no refill of that name, or a regained
 * formula could not be rolled. A field whose value is no list of counters of the template stays as it is.
 */
export function refillSheet(targets: readonly RefillTarget[], refills: readonly CounterRefill[], known: KnownRefills, name: string, roll: RegainRoll): RefilledField[] | null {
  const refill = refills.find((each) => each.name === name);
  if (refill === undefined) return null;
  const refilled: RefilledField[] = [];
  for (const { field, value } of targets) {
    const rows = shownCounterRows(field, value, known);
    if (rows === null) continue;
    const uses = refilledUses(rows, refill, roll);
    if (uses === undefined) return null;
    const next = uses === null ? null : withCountersUsed(field, value, known, uses);
    if (next !== null) refilled.push({ field, base: value, next });
  }
  return refilled;
}
