import { isRecord, type SheetRaw } from '../../protocol/index.ts';
import type { FieldValue, TemplateField } from '../../../statblocks/model/templateTypes';
import { COUNTER_ROW_KEYS, readCounterRow, shownCounterRows, withCountersUsed, type KnownRefills } from '../../../statblocks/values/counterValues';

/**
 * The value a Counters field holds once a player's whole list is in, or null where it changes more
 * than uses: a page sends every row back (one pip, a refill), and only `used` may differ from what the
 * note holds now (its rows, or the template's preset rows where it holds none), as a whole number up
 * to the row's maximum. Names, maximums, refills and regained formulas (compared exactly, as
 * written) and their order must be the note's, and a row holds nothing else. A note whose rows are
 * no counters of the template (`refills`: the names it defines) is never changed. Every other key a row of the note holds stays as it is.
 */
export function countersAfterEdit(field: TemplateField, stored: FieldValue | undefined, value: SheetRaw, refills: KnownRefills): FieldValue | null {
  const now = shownCounterRows(field, stored, refills);
  if (!now || !Array.isArray(value) || value.length !== now.length) return null;
  const uses: number[] = [];
  for (const [index, item] of value.entries()) {
    const was = now[index];
    const row = readCounterRow(item);
    if (!was || !row || !isRecord(item) || typeof item.used !== 'number' || Object.keys(item).some((key) => !COUNTER_ROW_KEYS.has(key))) return null;
    if (row.name !== was.name || row.max !== was.max || row.reset !== was.reset || row.regain !== was.regain) return null;
    uses.push(row.used);
  }
  return withCountersUsed(field, stored, refills, uses);
}
