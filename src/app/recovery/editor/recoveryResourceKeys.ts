/**
 * A resource added in the settings dialog has a placeholder key until it is saved, when it takes
 * one from its name (`withFinalKeys`). Rules made for it in the same dialog follow it to that key.
 * Pure.
 */

import type { ResourceDefinition } from '../../resources/resourceTypes';
import type { RecoveryRecord, RecoveryRule, ResourceOrCounters } from '../recoveryTypes';

/** Each key that changes on saving, mapped to the key it is saved with; `saved` lists `draft` in the same order. */
export function changedResourceKeys(draft: readonly ResourceDefinition[], saved: readonly ResourceDefinition[]): Map<string, string> {
  const keys = new Map<string, string>();
  draft.forEach((resource, index) => {
    const final = saved[index]?.key;
    if (final !== undefined && final !== resource.key) keys.set(resource.key, final);
  });
  return keys;
}

function retarget<T extends ResourceOrCounters>(target: T, keys: ReadonlyMap<string, string>): T {
  return target.kind === 'resource' && keys.has(target.key) ? { ...target, key: keys.get(target.key)! } : target;
}

function retargetRule(rule: RecoveryRule, keys: ReadonlyMap<string, string>): RecoveryRule {
  if (rule.target.kind === 'condition') return rule;
  const target = retarget(rule.target, keys);
  return rule.does === 'spend' ? { ...rule, target, from: retarget(rule.from, keys) } : { ...rule, target } as RecoveryRule;
}

/** The record with every rule on a resource whose key changes pointing at its saved key, the rules of every action included. */
export function withSavedResourceKeys(record: RecoveryRecord, keys: ReadonlyMap<string, string>): RecoveryRecord {
  if (keys.size === 0) return record;
  return Object.fromEntries(Object.entries(record).map(([templateId, buttons]) => [
    templateId,
    buttons.map((button) => ({
      ...button,
      rules: button.rules.map((rule) => retargetRule(rule, keys)),
      ...(button.choices && {
        choices: button.choices.map((choice) => ({
          ...choice,
          actions: choice.actions.map((action) => ({ ...action, rules: action.rules.map((rule) => retargetRule(rule, keys)) })),
        })),
      }),
    })),
  ]));
}
