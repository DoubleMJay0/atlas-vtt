/**
 * Reads recovery buttons where they arrive unchecked: a collection's settings, a preset file, a
 * bundle. Strict: a button or rule it cannot read whole is left out, never guessed at, and what
 * it keeps is capped at `MAX_RECOVERY_BUTTONS` buttons per template and `MAX_RECOVERY_RULES`
 * rules per button. Pure.
 */

import { isRecord, own } from '../statblocks/format/jsonValues';
import { isValidTemplateId } from '../statblocks/model/templateIds';
import type { TemplateId } from '../statblocks/model/templateTypes';
import { FORMULA_LIMITS } from '../tools/formulaTypes';
import {
  MAX_RECOVERY_BUTTONS,
  MAX_RECOVERY_RULES,
  type ConditionTarget,
  type RecoveryButton,
  type RecoveryRecord,
  type RecoveryRule,
  type ResourceOrCounters,
} from './recoveryTypes';

/** The longest id or name a button, metric or field may have. */
const MAX_RECOVERY_TEXT = 100;
/** The largest number a rule names (a minimum, a value to set, a cap, a step). */
const MAX_RECOVERY_NUMBER = 1_000_000;

/** A text that is not blank, at most `MAX_RECOVERY_TEXT` long, as written; undefined otherwise. */
function name(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_RECOVERY_TEXT ? value : undefined;
}

/** A formula as written, trimmed: not blank and no longer than a formula may be. */
function formula(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text !== '' && text.length <= FORMULA_LIMITS.characters ? text : undefined;
}

function whole(value: unknown, least: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= least && value <= MAX_RECOVERY_NUMBER ? value : undefined;
}

/**
 * An optional whole number of at least `least`: no value where it is absent, the value where it
 * reads, and null where it is present and does not (which leaves the rule out: a minimum or cap dropped
 * would change what the rule gives).
 */
function optionalWhole(raw: Record<string, unknown>, key: string, least: number): { value?: number } | null {
  const value = own(raw, key);
  if (value === undefined) return {};
  const read = whole(value, least);
  return read === undefined ? null : { value: read };
}

/** The ids of the buttons whose rows a counters target restores, each once; undefined where any is no id. */
function rowIds(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.map(name);
  if (!ids.every((id): id is string => id !== undefined)) return undefined;
  const unique = [...new Set(ids)];
  return unique.length <= MAX_RECOVERY_BUTTONS ? unique : undefined;
}

/** A resource or counters target, or undefined where it is neither. */
function metricTarget(value: unknown): ResourceOrCounters | undefined {
  if (!isRecord(value)) return undefined;
  const kind = own(value, 'kind');
  if (kind === 'resource') {
    const key = name(own(value, 'key'));
    return key === undefined ? undefined : { kind, key };
  }
  if (kind !== 'counters') return undefined;
  const field = name(own(value, 'field'));
  const raw = own(value, 'rows');
  const rows = raw === 'all' ? 'all' : rowIds(raw);
  return field === undefined || rows === undefined ? undefined : { kind, field, rows };
}

function conditionTarget(value: unknown): ConditionTarget | undefined {
  if (!isRecord(value) || own(value, 'kind') !== 'condition') return undefined;
  const id = name(own(value, 'id'));
  return id === undefined ? undefined : { kind: 'condition', id };
}

/** A rule on a metric with a maximum, or undefined where it cannot be read whole. */
function metricRule(raw: Record<string, unknown>, target: ResourceOrCounters): RecoveryRule | undefined {
  switch (own(raw, 'does')) {
    case 'full':
      return { target, does: 'full' };
    case 'amount': {
      const text = formula(own(raw, 'formula'));
      const min = optionalWhole(raw, 'min', 0);
      if (text === undefined || min === null) return undefined;
      return { target, does: 'amount', formula: text, ...(min.value !== undefined && { min: min.value }) };
    }
    case 'share': {
      const share = own(raw, 'share');
      const round = own(raw, 'round');
      const min = optionalWhole(raw, 'min', 0);
      if ((share !== 0.25 && share !== 0.5) || (round !== 'down' && round !== 'up') || min === null) return undefined;
      return { target, does: 'share', share, round, ...(min.value !== undefined && { min: min.value }) };
    }
    case 'set': {
      const to = own(raw, 'to');
      if (isRecord(to)) {
        const field = name(own(to, 'field'));
        return field === undefined ? undefined : { target, does: 'set', to: { field } };
      }
      const value = whole(to, 0);
      return value === undefined ? undefined : { target, does: 'set', to: value };
    }
    case 'spend': {
      const from = metricTarget(own(raw, 'from'));
      const each = formula(own(raw, 'each'));
      const most = optionalWhole(raw, 'most', 1);
      if (from === undefined || each === undefined || most === null) return undefined;
      return { target, does: 'spend', from, each, ...(most.value !== undefined && { most: most.value }) };
    }
    default:
      return undefined;
  }
}

/** A rule on a condition, or undefined where it cannot be read whole. */
function conditionRule(raw: Record<string, unknown>, target: ConditionTarget): RecoveryRule | undefined {
  switch (own(raw, 'does')) {
    case 'step': {
      const by = own(raw, 'by');
      if (typeof by !== 'number' || whole(Math.abs(by), 1) === undefined) return undefined;
      return { target, does: 'step', by };
    }
    case 'clear':
      return { target, does: 'clear' };
    default:
      return undefined;
  }
}

/**
 * One rule, or undefined: a target of a kind the rule does not take (a condition has no maximum
 * to fill, a resource no step), or any part it cannot read, leaves it out.
 */
export function parseRecoveryRule(raw: unknown): RecoveryRule | undefined {
  if (!isRecord(raw)) return undefined;
  const target = own(raw, 'target');
  const metric = metricTarget(target);
  if (metric) return metricRule(raw, metric);
  const condition = conditionTarget(target);
  return condition ? conditionRule(raw, condition) : undefined;
}

/** One button: an id and a name, and the rules it can read, the first `MAX_RECOVERY_RULES`. */
export function parseRecoveryButton(raw: unknown): RecoveryButton | undefined {
  if (!isRecord(raw)) return undefined;
  const id = name(own(raw, 'id'));
  const label = name(own(raw, 'name'));
  const rules = own(raw, 'rules');
  if (id === undefined || label === undefined || !Array.isArray(rules)) return undefined;
  const read = rules.flatMap((rule) => parseRecoveryRule(rule) ?? []).slice(0, MAX_RECOVERY_RULES);
  return { id, name: label.trim(), rules: read };
}

/** A template's buttons that can be read, the first of each id, the first `MAX_RECOVERY_BUTTONS`. */
export function parseRecoveryButtons(raw: unknown): RecoveryButton[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const buttons: RecoveryButton[] = [];
  for (const entry of raw) {
    const button = parseRecoveryButton(entry);
    if (!button || ids.has(button.id)) continue;
    ids.add(button.id);
    buttons.push(button);
    if (buttons.length === MAX_RECOVERY_BUTTONS) break;
  }
  return buttons;
}

/**
 * The buttons of each template as stored: undefined where `raw` is no record at all. A key that is
 * no template id, or a template left with no button that reads, is left out. An empty record is
 * kept: it says the collection has buttons of its own, none.
 */
export function parseRecovery(raw: unknown): RecoveryRecord | undefined {
  if (!isRecord(raw)) return undefined;
  const entries = Object.keys(raw).flatMap((templateId): Array<[TemplateId, RecoveryButton[]]> => {
    if (!isValidTemplateId(templateId)) return [];
    const buttons = parseRecoveryButtons(raw[templateId]);
    return buttons.length > 0 ? [[templateId, buttons]] : [];
  });
  return Object.fromEntries(entries);
}
