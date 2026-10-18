/**
 * Reads the refills a template names for its whole sheet, and notes every name its counters use that
 * it does not define: a refill bringing along another the template lacks, or a row it starts with
 * refilled by one, and a regained count that is no formula Atlas rolls. Such values are kept as
 * written and refill nothing.
 */

import type { CounterRefillDefinition, StatblockTemplate } from '../model/templateTypes';
import { isRegainFormula } from '../values/counterRegain';
import { COUNTER_REFILL_KEYS } from './formatKeys';
import { describeValue, isRecord } from './jsonValues';
import { ObjectReader } from './objectReader';
import { asString } from './valueReads';

/** The template's refills; one without a name, or with the name of an earlier one, is left out (and written back as the file had it). */
export function readRefills(r: ObjectReader<keyof StatblockTemplate>): Partial<Pick<StatblockTemplate, 'refills'>> {
  const names = new Set<string>();
  const read = (raw: unknown, index: number): CounterRefillDefinition | undefined => {
    if (!isRecord(raw)) return undefined;
    const item = new ObjectReader(raw, `${r.where} › refill ${index + 1}`, r.problems, COUNTER_REFILL_KEYS);
    const name = item.get('name', asString);
    if (name === undefined || name.trim() === '' || names.has(name)) return undefined;
    names.add(name);
    return item.finish({ name, ...item.optList('includes', asString, 'text') });
  };
  return r.optList('refills', read, 'refills with a name of their own');
}

/** Sentences for what the template's counters name and it does not define. */
export function refillProblems(template: StatblockTemplate): string[] {
  const refills = template.refills ?? [];
  const names = new Set(refills.map((refill) => refill.name));
  const problems: string[] = [];
  for (const refill of refills) {
    for (const other of refill.includes ?? []) {
      if (!names.has(other) || other === refill.name) problems.push(`The template: refill ${describeValue(refill.name)} brings along ${describeValue(other)}, which is no other refill of the template; it is ignored.`);
    }
  }
  for (const field of template.fields) {
    for (const row of field.counterRows ?? []) {
      const where = `Field ${describeValue(field.key)}: counter ${describeValue(row.name)}`;
      if (row.reset !== undefined && !names.has(row.reset)) problems.push(`${where} is refilled by ${describeValue(row.reset)}, which the template does not name; nothing refills it.`);
      if (row.regain !== undefined && !isRegainFormula(row.regain)) problems.push(`${where} regains ${describeValue(row.regain)}, which is no dice formula Atlas rolls; it regains all of its uses.`);
    }
  }
  return problems;
}
