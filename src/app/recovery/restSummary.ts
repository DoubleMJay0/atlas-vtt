/**
 * What taking a rest says: its changes with their rolls ("HP 4 → 18 (2d8+2) · Wand 0 → 3"), and
 * the rules it skipped with their reason.
 */

import { formatList, t } from '../i18n';
import { readableFormula } from './recoveryFormula';
import type { RestChange, RestSkip, SkippedRule } from './restTypes';

const SEPARATOR = ' · ';

/** One change: "HP 4 → 18 (2d8+2)". */
export function changeText(change: RestChange): string {
  const values = { label: change.label, from: change.from, to: change.to };
  if (change.rolls.length === 0) return t('rest.change', values);
  return t('rest.changeRolled', { ...values, rolls: change.rolls.map((roll) => readableFormula(roll.formula)).join(', ') });
}

function skipText(label: string, reason: RestSkip): string {
  switch (reason.kind) {
    case 'unknown-resource': case 'unknown-field': case 'unknown-condition': return t('rest.skipUnknown', { label });
    case 'static-resource': return t('rest.skipStatic', { label });
    case 'no-value': return t('rest.skipNoValue', { label });
    case 'no-token': return t('rest.skipNoToken', { label });
    case 'unreadable-counters': return t('rest.skipCounters', { label });
    case 'roll': return t('rest.skipRoll', { label });
    case 'formula': {
      const { problem } = reason;
      switch (problem.kind) {
        case 'missing': return t('rest.skipMissingField', { label, field: problem.field });
        case 'not-whole': return t('rest.skipNotWhole', { label, field: problem.field });
        case 'limits': return problem.field === null ? t('rest.skipLimits', { label }) : t('rest.skipLimitsField', { label, field: problem.field });
        case 'syntax': return t('rest.skipSyntax', { label });
      }
    }
  }
}

/** The rules skipped, each with its reason. */
export function skippedText(skipped: readonly SkippedRule[]): string {
  return formatList(skipped.map((rule) => skipText(rule.label, rule.reason)));
}

/** What a rest of `buttonName` did, in one or two lines: its changes, then what it skipped. */
export function restSummaryText(buttonName: string, changes: readonly RestChange[], skipped: readonly SkippedRule[]): string {
  const done = changes.length > 0
    ? t('rest.done', { button: buttonName, changes: changes.map(changeText).join(SEPARATOR) })
    : t('rest.nothing', { button: buttonName });
  return skipped.length > 0 ? `${done}\n${t('rest.skipped', { list: skippedText(skipped) })}` : done;
}
