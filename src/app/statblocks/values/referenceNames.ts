/**
 * The names a statblock's `@` references can be written with, each with the number it reads now:
 * what typing `@` in a value offers. The names tried are every field by its key and by its label,
 * what a field holds one step in (`saves.dex`), every Table slot with each worked-out row of its
 * Table (`str`, `str.mod`) and hit points (`hp`); the card's own lookup (`statblockLookup`) decides
 * which of them name a number. So every name offered reads what the card fills in, and a name the
 * lookup comes to accept (a label) is offered as soon as it does. Pure.
 */

import { normalizedKey } from '../../resources/resourceFields';
import { withHeaderFields } from '../model/templateHeader';
import type { StatblockTemplate, TemplateField } from '../model/templateTypes';
import { isPairsList, readerFor, slotKeyOf, type FieldRecord } from './fieldValues';
import { formatNumber, parseNumberText } from './numberText';
import { referencePathAt } from './references';
import { statblockLookup, tableColumns } from './statblockLookup';

/** A name a reference can be written with, and the number it reads, as the list shows it. */
export interface ReferenceName {
  readonly name: string;
  readonly value: string;
}

/** The most names one statblock offers. */
export const MAX_REFERENCE_NAMES = 256;
/** How many entries of a list or a record are offered one step in. */
const MAX_INSIDE = 32;

/** A name or label as a reference writes it: lower case, a hyphen for spaces, nothing a reference cannot hold. */
export function referenceWord(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/^-+|-+$/g, '');
}

/** Whether `name` reads as one whole reference after an `@`. */
const isReferencePath = (name: string): boolean => name !== '' && referencePathAt(`@${name}`, 0) === name;

/** A name without case or separators in any of its parts: two names alike so read the same. */
const sameAs = (name: string): string => name.split('.').map(normalizedKey).join('.');

/** The number a value reads as, as the card shows it: a number, or a text that writes one as written (`+2`). */
function shownNumber(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? formatNumber(value) : null;
  if (typeof value !== 'string' || parseNumberText(value) === null) return null;
  return value.trim();
}

/** The names a field is tried by: its key, what it holds one step in (a pair by its label), then its label. */
function fieldNames(field: TemplateField, value: unknown): string[] {
  const inside = Array.isArray(value) ? (isPairsList(value) ? value.flatMap((pair) => Object.keys(pair as object)) : value.map((_, index) => String(index))).slice(0, MAX_INSIDE)
    : value !== null && typeof value === 'object' ? Object.keys(value).slice(0, MAX_INSIDE) : [];
  return [field.key, ...inside.map((part) => `${field.key}.${part}`), referenceWord(field.label)];
}

/** The names of a Table field's slots (as the card shows them, then by key), each alone and with every worked-out row of its Table. */
function slotNames(field: TemplateField, rows: readonly string[]): string[] {
  return (field.slots ?? []).flatMap((name, index) => [referenceWord(name), slotKeyOf(field, index)].flatMap((slot) => {
    if (slot === undefined || slot === '') return [];
    return [slot, ...rows.map((row) => `${slot}.${referenceWord(row)}`)];
  }));
}

/**
 * Every name `@` can be followed by in this statblock, in the template's order, each once (names
 * alike without case or separators are one), with the number it reads now.
 */
export function referenceNames(template: StatblockTemplate, record: FieldRecord): ReferenceName[] {
  const { fields } = withHeaderFields(template);
  const lookup = statblockLookup(template, record, fields);
  const reader = readerFor(record, fields);
  const columns = tableColumns(template);
  const tried = [
    ...fields.flatMap((field) => (field.type === 'scores'
      ? slotNames(field, (columns.get(field.key) ?? []).flatMap((column) => column.label ?? []))
      : fieldNames(field, reader(field.key)))),
    'hp',
  ];
  const names: ReferenceName[] = [];
  const seen = new Set<string>();
  for (const name of tried) {
    if (names.length >= MAX_REFERENCE_NAMES) break;
    const same = sameAs(name);
    if (seen.has(same) || !isReferencePath(name)) continue;
    seen.add(same);
    const value = shownNumber(lookup(name));
    if (value !== null) names.push({ name, value });
  }
  return names;
}

/**
 * The names that fit what was typed after the `@`, without case or separators: those that start
 * with it, then those that hold it, each in their order. Everything for nothing typed.
 */
export function namesFitting<T extends { readonly name: string }>(names: readonly T[], typed: string): T[] {
  const wanted = sameAs(typed);
  if (wanted === '') return [...names];
  const starting = names.filter((each) => sameAs(each.name).startsWith(wanted));
  return [...starting, ...names.filter((each) => !starting.includes(each) && sameAs(each.name).includes(wanted))];
}
