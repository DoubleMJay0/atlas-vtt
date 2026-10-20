/**
 * Recovery buttons: what a collection's statblock template offers a player character to get its
 * metrics back with ("Short rest", "Long rest"). A button is a list of rules, each saying what
 * happens to one metric: a token resource, a row of counters or a valued condition. Rules belong
 * to the button, never to the metric, so one metric may be restored differently by each button.
 * Pure data.
 */

import type { FieldKey, TemplateId } from '../statblocks/model/templateTypes';

/** The most buttons one template offers, and the most rules one button holds. */
export const MAX_RECOVERY_BUTTONS = 6;
export const MAX_RECOVERY_RULES = 16;

/** A collection resource, by its key (`ResourceDefinition.key`): HP, Stress. */
export interface ResourceTarget {
  kind: 'resource';
  key: string;
}

/**
 * The rows of a Counters field: every row, or those whose `reset` (in the note) names one of these
 * buttons, by id. A Long rest may so restore the rows set to Short rest as well.
 */
export interface CountersTarget {
  kind: 'counters';
  field: FieldKey;
  rows: 'all' | readonly string[];
}

/** A valued condition of the collection, by its id (Exhaustion). */
export interface ConditionTarget {
  kind: 'condition';
  id: string;
}

/** What a rule changes. */
export type RecoveryTarget = ResourceTarget | CountersTarget | ConditionTarget;

/** The metrics that have a maximum to restore towards. */
export type ResourceOrCounters = ResourceTarget | CountersTarget;

/** Back to its full value. */
export interface FullRule {
  target: ResourceOrCounters;
  does: 'full';
}

/** Back by a formula ("1d4+@tier", "@level"), at least `min` where set. */
export interface AmountRule {
  target: ResourceOrCounters;
  does: 'amount';
  formula: string;
  min?: number;
}

/** Back by a share of the maximum, rounded `round`, at least `min` where set. */
export interface ShareRule {
  target: ResourceOrCounters;
  does: 'share';
  share: 0.25 | 0.5;
  round: 'down' | 'up';
  min?: number;
}

/** Set to a number, or to the number a statblock field holds (Stress to 0). */
export interface SetRule {
  target: ResourceOrCounters;
  does: 'set';
  to: number | { field: FieldKey };
}

/**
 * Back by spending another metric (Hit Dice): the player picks how many units, up to what `from`
 * holds and `most` where set; each adds `each` to one formula.
 */
export interface SpendRule {
  target: ResourceOrCounters;
  does: 'spend';
  from: ResourceOrCounters;
  each: string;
  most?: number;
}

/** A condition's value moved by `by` (Exhaustion −1); at 0 it goes. */
export interface StepRule {
  target: ConditionTarget;
  does: 'step';
  by: number;
}

/** A condition gone. */
export interface ClearRule {
  target: ConditionTarget;
  does: 'clear';
}

export type RecoveryRule = FullRule | AmountRule | ShareRule | SetRule | SpendRule | StepRule | ClearRule;

export type RecoveryRuleKind = RecoveryRule['does'];

export interface RecoveryButton {
  /** Never changes: requests, counter rows and logs name it. */
  id: string;
  /** "Long rest". */
  name: string;
  /** Applied in order. */
  rules: RecoveryRule[];
}

/** The buttons of each template, by template id. */
export type RecoveryRecord = Readonly<Record<TemplateId, readonly RecoveryButton[]>>;
