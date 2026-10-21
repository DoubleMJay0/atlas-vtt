import { isReferenceKey, isReferenceNumber, MAX_SHEET_LIST, MAX_SHEET_REFERENCES, referenceKey, type SheetReferences } from '../../protocol/index.ts';
import { HIT_POINT_KEYS } from '../../../resources/resourceFields';
import type { StatblockTemplate, TemplateField } from '../../../statblocks/model/templateTypes';
import { readerFor, slotKeyOf, type FieldRecord } from '../../../statblocks/values/fieldValues';
import { parseNumberText } from '../../../statblocks/values/numberText';
import { statblockLookup, tableColumns } from '../../../statblocks/values/statblockLookup';

/** The number a reference reads, as the card fills it in: a number, or text that writes one. */
function numberOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return typeof value === 'string' ? parseNumberText(value) : null;
}

/** The paths of a field's own value and of what it holds one step in (`stats.0`, `saves.dex`), under its key and every key it had. */
function fieldPaths(field: TemplateField, value: unknown): string[] {
  const inside = Array.isArray(value) ? value.slice(0, MAX_SHEET_LIST).map((_, index) => String(index))
    : value !== null && typeof value === 'object' ? Object.keys(value).slice(0, MAX_SHEET_LIST) : [];
  return [field.key, ...(field.formerKeys ?? [])].flatMap((key) => [key, ...inside.map((part) => `${key}.${part}`)]);
}

/** The paths of every slot of a Table field, by name and key, alone and after the field's key, each with every worked-out row. */
function slotPaths(field: TemplateField, rows: readonly string[]): string[] {
  return (field.slots ?? []).flatMap((name, index) => [name, slotKeyOf(field, index)].flatMap((slot) => {
    if (slot === undefined || slot === '') return [];
    return [slot, `${field.key}.${slot}`].flatMap((path) => [path, ...rows.map((row) => `${path}.${row}`)]);
  }));
}

/**
 * The numbers a player's `@` references read on their character's sheet (`BookStatblock.references`),
 * worked out by the card's own lookup (`statblockLookup`) over `shown`, the values the player may see
 * (`shownRecord`): each field by its key and the keys it had, what it holds one step in, every Table
 * slot by name and key with each worked-out row, and hit points by their usual names. A reference to
 * a hidden field reads nothing here, as it reads nothing on the card the player is sent. Undefined
 * where none names a number.
 */
export function sheetReferences(template: StatblockTemplate, shown: FieldRecord, fields: readonly TemplateField[]): SheetReferences | undefined {
  const lookup = statblockLookup(template, shown, fields);
  const reader = readerFor(shown, fields);
  const columns = tableColumns(template);
  const paths = [
    ...fields.flatMap((field) => fieldPaths(field, reader(field.key))),
    ...fields.filter((field) => field.type === 'scores').flatMap((field) => slotPaths(field, (columns.get(field.key) ?? []).flatMap((column) => column.label ?? []))),
    ...HIT_POINT_KEYS,
  ];
  const references: Record<string, number> = {};
  let count = 0;
  for (const path of paths) {
    const key = referenceKey(path);
    if (count >= MAX_SHEET_REFERENCES) break;
    if (!isReferenceKey(key) || Object.hasOwn(references, key)) continue;
    const number = numberOf(lookup(path));
    if (number === null || !isReferenceNumber(number)) continue;
    references[key] = number;
    count += 1;
  }
  return count === 0 ? undefined : references;
}
