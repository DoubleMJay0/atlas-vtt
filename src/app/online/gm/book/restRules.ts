import { readableFormula } from '../../../recovery/recoveryFormula';
import type { PlannedRule, RestChoices, RestPlan } from '../../../recovery/restTypes';

const MINUS = '−';

/** A signed whole number with a true minus sign. */
const signed = (value: number): string => (value < 0 ? `${MINUS}${Math.abs(value)}` : `+${value}`);

/** What one planned rule will do, as the GM reads it on a request's card; null for a spend of nothing. */
function ruleText(planned: PlannedRule, choices: RestChoices): string | null {
  const { rule, target } = planned;
  const label = target.label;
  switch (rule.does) {
    case 'full': return `${label} to full`;
    case 'amount': return `${label} +${readableFormula(planned.formula?.formula ?? rule.formula)}`;
    case 'share': return `${label} +${rule.share === 0.5 ? '½' : '¼'}`;
    case 'set': return `${label} → ${planned.to ?? 0}`;
    case 'spend': {
      const units = choices.spends.get(planned.index) ?? 0;
      return units === 0 ? null : `${units} ${planned.spend?.label ?? label}`;
    }
    case 'step': return `${label} ${signed(rule.by)}`;
    case 'clear': return `${label} cleared`;
  }
}

/**
 * What a rest will do, rule by rule, as the request's card shows it behind its line: "HP to full",
 * "2 Hit Dice", "Exhaustion −1". A Spend rule names how many units the player spends, and none
 * where they spend nothing; rules the rest skips are left out.
 */
export function restRulesText(plan: RestPlan, choices: RestChoices): string[] {
  return plan.rules.flatMap((planned) => ruleText(planned, choices) ?? []);
}
