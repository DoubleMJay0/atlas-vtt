/**
 * What a recovery button would do for a character: for each rule, the metric it changes as the
 * character holds it now, its formula with the note's numbers in, and the choice a Spend rule asks
 * for. A rule whose metric, value or formula cannot be found is skipped, with the reason. Pure.
 */

import { shownCounterRows } from '../statblocks/values/counterValues';
import { wholeNumber } from '../statblocks/values/references';
import { fillFormula, type FormulaProblem } from './recoveryFormula';
import type { RecoveryButton, RecoveryRule, RecoveryTarget } from './recoveryTypes';
import { countersLeft } from './restCounters';
import type { PlannedRule, RestCharacter, RestMetric, RestPlan, RestSkip, SkippedRule } from './restTypes';

/** The metric a target names on the character, or why it has none. */
export function restMetric(target: RecoveryTarget, character: RestCharacter): RestMetric | RestSkip {
  switch (target.kind) {
    case 'resource': {
      const definition = character.resources.find((each) => each.key === target.key);
      if (!definition) return { kind: 'unknown-resource', key: target.key };
      if (definition.direction === 'static') return { kind: 'static-resource', key: target.key };
      const value = character.resourceValue(target.key);
      if (!value) return { kind: 'no-value', key: target.key };
      return { kind: 'resource', key: target.key, label: definition.name, definition, value };
    }
    case 'counters': {
      const field = character.fields.get(target.field);
      if (!field || field.type !== 'counters') return { kind: 'unknown-field', key: target.field };
      const value = character.fieldValue(target.field);
      if (shownCounterRows(field, value) === null) return { kind: 'unreadable-counters', key: target.field };
      return { kind: 'counters', key: target.field, label: field.label, field, rows: target.rows, value };
    }
    case 'condition': {
      const definition = character.conditions.find((each) => each.id === target.id && each.valued === true);
      if (!definition) return { kind: 'unknown-condition', id: target.id };
      const value = character.conditionValue(target.id);
      if (value === null) return { kind: 'no-token', id: target.id };
      return { kind: 'condition', id: target.id, label: definition.name, definition, value };
    }
  }
}

const isMetric = (found: RestMetric | RestSkip): found is RestMetric => found.kind === 'resource' || found.kind === 'counters' || found.kind === 'condition';

/** How a target is called where the character has no metric for it: its definition's or field's name where those exist. */
function targetLabel(target: RecoveryTarget, character: RestCharacter): string {
  switch (target.kind) {
    case 'resource': return character.resources.find((each) => each.key === target.key)?.name ?? target.key;
    case 'counters': return character.fields.get(target.field)?.label ?? target.field;
    case 'condition': return character.conditions.find((each) => each.id === target.id)?.name ?? target.id;
  }
}

/** How many units a metric holds to spend: what is left of a resource or of the named counters. */
export function spendable(metric: RestMetric): number {
  switch (metric.kind) {
    case 'resource': return metric.definition.direction === 'fills' ? metric.value.max - metric.value.current : metric.value.current;
    case 'counters': return countersLeft(metric.field, metric.value, metric.rows);
    case 'condition': return 0;
  }
}

/** The number a field holds for a Set rule, or the problem that refuses it. */
function fieldNumber(field: string, character: RestCharacter): number | FormulaProblem {
  const value = character.lookup(field);
  if (value === undefined) return { kind: 'missing', field };
  return wholeNumber(value) ?? { kind: 'not-whole', field };
}

/** The rule planned on its target, or why it is skipped. */
function planRule(rule: RecoveryRule, index: number, target: RestMetric, character: RestCharacter): PlannedRule | RestSkip {
  const planned = { index, rule, target };
  switch (rule.does) {
    case 'amount': {
      const formula = fillFormula(rule.formula, (path) => character.lookup(path));
      return formula.ok ? { ...planned, formula } : { kind: 'formula', problem: formula.problem };
    }
    case 'set': {
      const to = typeof rule.to === 'number' ? rule.to : fieldNumber(rule.to.field, character);
      return typeof to === 'number' ? { ...planned, to } : { kind: 'formula', problem: to };
    }
    case 'spend': {
      const source = restMetric(rule.from, character);
      if (!isMetric(source)) return source;
      const formula = fillFormula(rule.each, (path) => character.lookup(path));
      if (!formula.ok) return { kind: 'formula', problem: formula.problem };
      const max = Math.min(spendable(source), rule.most ?? Number.POSITIVE_INFINITY);
      return { ...planned, source, formula, spend: { label: source.label, max: Math.max(0, max), each: formula.formula } };
    }
    default:
      return planned;
  }
}

/** What pressing `button` would do for `character`: its rules in order, each planned or skipped. */
export function restPlan(button: RecoveryButton, character: RestCharacter): RestPlan {
  const rules: PlannedRule[] = [];
  const skipped: SkippedRule[] = [];
  button.rules.forEach((rule, index) => {
    const target = restMetric(rule.target, character);
    const planned = isMetric(target) ? planRule(rule, index, target, character) : target;
    if ('rule' in planned) rules.push(planned);
    else skipped.push({ index, rule, label: isMetric(target) ? target.label : targetLabel(rule.target, character), reason: planned });
  });
  return { button, rules, skipped };
}
