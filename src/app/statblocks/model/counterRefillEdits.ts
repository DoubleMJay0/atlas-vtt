/**
 * Edits of the refills a template names for its whole sheet (`StatblockTemplate.refills`): added,
 * renamed, moved, removed, and which others each brings along. A rename or removal carries every
 * Counters field's preset rows and the other refills with it, so the template never names a refill
 * it lacks; notes keep what they wrote. Pure, each a new template; the template editor runs each as
 * one step, and a refused edit gives the same template back.
 */

import { MAX_REFILLS } from '../../online/protocol/sheetCounters';
import type { CounterPreset, CounterRefillDefinition, StatblockTemplate } from './templateTypes';

/** The template with `refills` as given, the key left out where it names none. */
function withRefills(template: StatblockTemplate, refills: CounterRefillDefinition[]): StatblockTemplate {
  const { refills: _refills, ...rest } = template;
  return refills.length > 0 ? { ...rest, refills } : rest;
}

/** The refill with `includes` as given, the key left out where it names none. */
function withIncludes(refill: CounterRefillDefinition, includes: string[]): CounterRefillDefinition {
  const { includes: _includes, ...rest } = refill;
  return includes.length > 0 ? { ...rest, includes } : rest;
}

/** The template with every preset row that is refilled by `from` refilled by `to` instead (by none where `to` is undefined). */
function withRowsRefilled(template: StatblockTemplate, from: string, to: string | undefined): StatblockTemplate {
  const follow = (row: CounterPreset): CounterPreset => {
    if (row.reset !== from) return row;
    const { reset: _reset, ...rest } = row;
    return to === undefined ? rest : { ...rest, reset: to };
  };
  const touches = template.fields.some((field) => field.counterRows?.some((row) => row.reset === from));
  if (!touches) return template;
  return { ...template, fields: template.fields.map((field) => (field.counterRows ? { ...field, counterRows: field.counterRows.map(follow) } : field)) };
}

/** Whether a template has room for another refill: a page takes `MAX_REFILLS` of them. */
export function hasRoomForRefill(template: Pick<StatblockTemplate, 'refills'>): boolean {
  return (template.refills?.length ?? 0) < MAX_REFILLS;
}

/** The template with a new refill named `name` at the end; unchanged where it has no name, another bears it, or there is no room. */
export function addedRefill(template: StatblockTemplate, name: string): StatblockTemplate {
  const refills = template.refills ?? [];
  if (name.trim() === '' || !hasRoomForRefill(template) || refills.some((refill) => refill.name === name)) return template;
  return withRefills(template, [...refills, { name }]);
}

/**
 * The template with the refill at `index` named `name`, the preset rows it refilled and the refills
 * bringing it along following the new name; unchanged where no such refill is, or another bears the name.
 */
export function renamedRefill(template: StatblockTemplate, index: number, name: string): StatblockTemplate {
  const refills = template.refills ?? [];
  const was = refills[index]?.name;
  if (was === undefined || name.trim() === '' || name === was || refills.some((refill) => refill.name === name)) return template;
  const follow = (other: string): string => (other === was ? name : other);
  const renamed = refills.map((refill, at) => withIncludes(at === index ? { ...refill, name } : refill, (refill.includes ?? []).map(follow)));
  return withRowsRefilled(withRefills(template, renamed), was, name);
}

/** The template without the refill at `index`: no other brings it along, and the preset rows it refilled are refilled by none. */
export function removedRefill(template: StatblockTemplate, index: number): StatblockTemplate {
  const refills = template.refills ?? [];
  const gone = refills[index]?.name;
  if (gone === undefined) return template;
  const left = refills.filter((_, at) => at !== index).map((refill) => withIncludes(refill, (refill.includes ?? []).filter((other) => other !== gone)));
  return withRowsRefilled(withRefills(template, left), gone, undefined);
}

/** The template with the refill at `from` moved to `to`; unchanged where either lies outside its refills. */
export function movedRefill(template: StatblockTemplate, from: number, to: number): StatblockTemplate {
  const refills = template.refills ?? [];
  const moved = refills[from];
  if (moved === undefined || to < 0 || to >= refills.length || to === from) return template;
  const rest = refills.filter((_, at) => at !== from);
  return withRefills(template, [...rest.slice(0, to), moved, ...rest.slice(to)]);
}

/** The template with the refill at `index` bringing `other` along, or no longer, in the order the template names its refills. */
export function withRefillIncluded(template: StatblockTemplate, index: number, other: string, included: boolean): StatblockTemplate {
  const refills = template.refills ?? [];
  const refill = refills[index];
  if (refill === undefined || refill.name === other) return template;
  const order = refills.map((each) => each.name);
  const kept = new Set((refill.includes ?? []).filter((name) => name !== other));
  if (included) kept.add(other);
  // Names no refill of the template bears stay, after the ones it does.
  const known = order.filter((name) => kept.has(name));
  const unknown = (refill.includes ?? []).filter((name) => kept.has(name) && !order.includes(name));
  return withRefills(template, refills.map((each, at) => (at === index ? withIncludes(each, [...known, ...unknown]) : each)));
}
