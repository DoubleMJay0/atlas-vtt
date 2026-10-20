import { useState } from 'react';
import {
  firstRule, kindFits, ruleFor, ruleOfKind, spendRule, withoutRule, withRule,
} from '../../../../recovery/editor/recoveryEdits';
import type { RecoveryButton, RecoveryRule, RecoveryRuleKind, RecoveryTarget } from '../../../../recovery/recoveryTypes';

/** A metric picked on the card: its spot and what a rule on it changes. */
export interface PickedMetric {
  spotId: string;
  target: RecoveryTarget;
}

export interface RuleEditing {
  picked: PickedMetric | null;
  /** The picked metric's rule under the selected button. */
  rule: RecoveryRule | undefined;
  fanOpen: boolean;
  cardOpen: boolean;
  /** Waiting for the metric a Spend rule spends: the card is closed meanwhile. */
  spending: boolean;
  /** The fan or the card was opened from the keyboard: its first control takes focus. */
  fromKeyboard: boolean;
  /** Adds the metric to the button where it is not in it yet, and opens its fan; picks the source while spending. */
  pick: (spotId: string, target: RecoveryTarget, fromKeyboard: boolean) => 'picked' | 'source' | 'full' | 'ignored';
  chooseKind: (kind: RecoveryRuleKind | 'remove', fromKeyboard: boolean) => void;
  changeRule: (rule: RecoveryRule) => void;
  /** Spend: waits for another metric to spend. */
  pickSource: () => void;
  /** Closes the innermost of fan, card and pick; false where nothing was open. */
  escape: () => boolean;
  closeAll: () => void;
}

/** Whether a rule needs the card: anything with a number or formula, and every counters rule (its rows). */
export function needsCard(rule: RecoveryRule): boolean {
  return rule.target.kind === 'counters' || (rule.does !== 'full' && rule.does !== 'clear');
}

/**
 * The picking of metrics on the card for one button, and the rules it sets: a metric picked is
 * added to the button with its first rule, its fan chooses the kind of rule, and the card under
 * it the rule's numbers. Every change goes to `onButton` at once.
 */
export function useRuleEditing(button: RecoveryButton | null, onButton: (button: RecoveryButton) => void): RuleEditing {
  const [picked, setPicked] = useState<PickedMetric | null>(null);
  const [fanOpen, setFanOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [spending, setSpending] = useState(false);
  const [fromKeyboard, setFromKeyboard] = useState(false);
  const rule = button && picked ? ruleFor(button, picked.target) : undefined;

  const closeAll = (): void => {
    setPicked(null);
    setFanOpen(false);
    setCardOpen(false);
    setSpending(false);
  };

  const setRule = (next: RecoveryRule): boolean => {
    const changed = button && withRule(button, next);
    if (changed) onButton(changed);
    return changed !== null;
  };

  const pick: RuleEditing['pick'] = (spotId, target, keyboard) => {
    if (!button) return 'full';
    if (spending && picked) {
      // Only another metric with a maximum can be spent
      if (picked.target.kind === 'condition' || target.kind === 'condition' || spotId === picked.spotId) return 'ignored';
      setRule(spendRule(picked.target, target, rule));
      setSpending(false);
      setCardOpen(true);
      setFromKeyboard(keyboard);
      return 'source';
    }
    if (picked?.spotId === spotId && fanOpen) {
      setFanOpen(false);
      return 'picked';
    }
    const had = ruleFor(button, target);
    if (!had && !setRule(firstRule(target))) return 'full';
    const shown = had ?? firstRule(target);
    setPicked({ spotId, target });
    setFanOpen(true);
    setCardOpen(Boolean(had) && needsCard(shown));
    setSpending(false);
    setFromKeyboard(keyboard);
    return 'picked';
  };

  const chooseKind: RuleEditing['chooseKind'] = (kind, keyboard) => {
    if (!button || !picked) return;
    setFromKeyboard(keyboard);
    if (kind === 'remove') {
      onButton(withoutRule(button, picked.target));
      closeAll();
      return;
    }
    if (!kindFits(kind, picked.target)) return;
    const next = ruleOfKind(kind, picked.target, rule);
    if (kind === 'spend' && !next) {
      startSpending();
      return;
    }
    if (!next) return;
    setRule(next);
    setSpending(false);
    setCardOpen(needsCard(next));
  };

  /** Spend waits for the metric it spends: the card makes way, so every other metric can be clicked. */
  const startSpending = (): void => {
    setSpending(true);
    setFanOpen(false);
    setCardOpen(false);
  };

  const escape = (): boolean => {
    if (fanOpen) setFanOpen(false);
    else if (spending) setSpending(false);
    else if (cardOpen) setCardOpen(false);
    else if (picked) setPicked(null);
    else return false;
    return true;
  };

  return {
    picked,
    rule,
    fanOpen,
    cardOpen,
    spending,
    fromKeyboard,
    pick,
    chooseKind,
    changeRule: (next) => { setRule(next); },
    pickSource: startSpending,
    escape,
    closeAll,
  };
}
