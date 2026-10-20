/**
 * The edits the recovery editor makes to a template's buttons: add, rename, move and remove a
 * button, and set or remove the one rule a button has for a metric. Every edit returns new values
 * and leaves its input alone; one that would pass a limit returns null. Pure.
 */

import type { TemplateId } from '../../statblocks/model/templateTypes';
import {
  MAX_RECOVERY_BUTTONS,
  MAX_RECOVERY_RULES,
  type ConditionTarget,
  type RecoveryButton,
  type RecoveryRecord,
  type RecoveryRule,
  type RecoveryRuleKind,
  type RecoveryTarget,
  type ResourceOrCounters,
} from '../recoveryTypes';
import { metricKey } from './recoveryMetrics';

const NO_BUTTONS: readonly RecoveryButton[] = [];

/** The buttons of one template in a record; none where it has none. */
export function templateButtons(record: RecoveryRecord, templateId: TemplateId): readonly RecoveryButton[] {
  return Object.hasOwn(record, templateId) ? record[templateId]! : NO_BUTTONS;
}

/** The record with the template's buttons replaced; a template left with none is left out. */
export function withTemplateButtons(record: RecoveryRecord, templateId: TemplateId, buttons: readonly RecoveryButton[]): RecoveryRecord {
  const rest = Object.fromEntries(Object.entries(record).filter(([id]) => id !== templateId));
  return buttons.length > 0 ? { ...rest, [templateId]: buttons } : rest;
}

/** An id no button of `taken` has: it names the button for good, whatever it is renamed to. */
export function newButtonId(taken: readonly RecoveryButton[], random: () => number = Math.random): string {
  const ids = new Set(taken.map((button) => button.id));
  for (;;) {
    const id = `rest-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
    if (!ids.has(id)) return id;
  }
}

/** The buttons with a new one named `name` at their end; null where the template has as many as it may. */
export function withAddedButton(buttons: readonly RecoveryButton[], name: string, id: string): RecoveryButton[] | null {
  if (buttons.length >= MAX_RECOVERY_BUTTONS) return null;
  return [...buttons, { id, name: name.trim(), rules: [] }];
}

export function withRenamedButton(buttons: readonly RecoveryButton[], id: string, name: string): RecoveryButton[] {
  return buttons.map((button) => (button.id === id ? { ...button, name: name.trim() } : button));
}

/** The buttons in a new order, by id; ids it does not hold keep their place after those named. */
export function withButtonOrder(buttons: readonly RecoveryButton[], order: readonly string[]): RecoveryButton[] {
  const byId = new Map(buttons.map((button) => [button.id, button]));
  const named = order.flatMap((id) => byId.get(id) ?? []);
  return [...named, ...buttons.filter((button) => !order.includes(button.id))];
}

/** The button `id` moved by `step` places, as far as the ends allow. */
export function withButtonMoved(buttons: readonly RecoveryButton[], id: string, step: number): RecoveryButton[] {
  const from = buttons.findIndex((button) => button.id === id);
  if (from < 0) return [...buttons];
  const to = Math.max(0, Math.min(buttons.length - 1, from + step));
  const next = [...buttons];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/**
 * The buttons without `id`. Counters rules that restored the rows set to it no longer name it, so
 * no rule points at a button that is gone.
 */
export function withoutButton(buttons: readonly RecoveryButton[], id: string): RecoveryButton[] {
  return buttons.filter((button) => button.id !== id).map((button) => ({
    ...button,
    rules: button.rules.map((rule) => {
      if (rule.target.kind !== 'counters' || rule.target.rows === 'all' || !rule.target.rows.includes(id)) return rule;
      return { ...rule, target: { ...rule.target, rows: rule.target.rows.filter((row) => row !== id) } } as RecoveryRule;
    }),
  }));
}

/** The rule a button has for a metric; a counters rule matches its field, whatever rows it restores. */
export function ruleFor(button: RecoveryButton, target: RecoveryTarget): RecoveryRule | undefined {
  const key = metricKey(target);
  return button.rules.find((rule) => metricKey(rule.target) === key);
}

/**
 * The button with `rule` in place of the one it had for the same metric, or after the others;
 * null where it would hold more rules than a button may.
 */
export function withRule(button: RecoveryButton, rule: RecoveryRule): RecoveryButton | null {
  const key = metricKey(rule.target);
  const at = button.rules.findIndex((other) => metricKey(other.target) === key);
  if (at < 0 && button.rules.length >= MAX_RECOVERY_RULES) return null;
  const rules = at < 0 ? [...button.rules, rule] : button.rules.map((other, index) => (index === at ? rule : other));
  return { ...button, rules };
}

export function withoutRule(button: RecoveryButton, target: RecoveryTarget): RecoveryButton {
  const key = metricKey(target);
  return { ...button, rules: button.rules.filter((rule) => metricKey(rule.target) !== key) };
}

/** Whether a metric takes a kind of rule: a condition only steps and clears, the others never do. */
export function kindFits(kind: RecoveryRuleKind, target: RecoveryTarget): boolean {
  const onCondition = kind === 'step' || kind === 'clear';
  return onCondition === (target.kind === 'condition');
}

/** The rule a metric gets when it is added: back to full, or a condition one step down. */
export function firstRule(target: RecoveryTarget): RecoveryRule {
  return target.kind === 'condition' ? { target, does: 'step', by: -1 } : { target, does: 'full' };
}

/**
 * The rule of `kind` on a metric, keeping what the rule it had says where the kind takes it (a
 * minimum, a formula); undefined for Spend, which needs a metric to spend first.
 */
export function ruleOfKind(kind: RecoveryRuleKind, target: RecoveryTarget, had?: RecoveryRule): RecoveryRule | undefined {
  if (target.kind === 'condition') return conditionRule(kind, target, had);
  const min = had && (had.does === 'amount' || had.does === 'share') ? had.min : undefined;
  const keptMin = min === undefined ? {} : { min };
  switch (kind) {
    case 'full': return { target, does: 'full' };
    case 'amount': return { target, does: 'amount', formula: had?.does === 'amount' ? had.formula : '1', ...keptMin };
    case 'share': return had?.does === 'share' ? had : { target, does: 'share', share: 0.5, round: 'down', ...keptMin };
    case 'set': return had?.does === 'set' ? had : { target, does: 'set', to: 0 };
    case 'spend': return had?.does === 'spend' ? had : undefined;
    default: return undefined;
  }
}

function conditionRule(kind: RecoveryRuleKind, target: ConditionTarget, had?: RecoveryRule): RecoveryRule | undefined {
  if (kind === 'clear') return { target, does: 'clear' };
  if (kind === 'step') return had?.does === 'step' ? had : { target, does: 'step', by: -1 };
  return undefined;
}

/** A Spend rule on `target` that spends `from`, each unit adding `each`. */
export function spendRule(target: ResourceOrCounters, from: ResourceOrCounters, had?: RecoveryRule): RecoveryRule {
  const each = had?.does === 'spend' ? had.each : '1';
  const most = had?.does === 'spend' ? had.most : undefined;
  return { target, does: 'spend', from, each, ...(most !== undefined && { most }) };
}

/** The rule with its target's rows set (counters only); other rules as they are. */
export function withRows(rule: RecoveryRule, rows: 'all' | readonly string[]): RecoveryRule {
  if (rule.target.kind !== 'counters') return rule;
  return { ...rule, target: { ...rule.target, rows } } as RecoveryRule;
}
