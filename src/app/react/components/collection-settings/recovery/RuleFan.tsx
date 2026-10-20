import React, { useState } from 'react';
import { ArrowLeftRight, BatteryFull, ChevronsDown, Equal, Eraser, Plus, Trash2 } from 'lucide-react';
import { t, type MessageKey } from '../../../../i18n';
import { kindFits } from '../../../../recovery/editor/recoveryEdits';
import type { RecoveryRule, RecoveryRuleKind, RecoveryTarget } from '../../../../recovery/recoveryTypes';
import { RadialFan, type FanButton } from '../fan/RadialFan';
import type { RuleFanPlace } from './rulePlacement';

interface RuleFanProps {
  place: RuleFanPlace;
  target: RecoveryTarget;
  rule: RecoveryRule | undefined;
  /** The metric's name and the button's, for the fan's name and Remove. */
  metric: string;
  button: string;
  /** Whether the card holds another metric a Spend rule could spend. */
  canSpend: boolean;
  focusFirst: boolean;
  onChoose: (kind: RecoveryRuleKind | 'remove', fromKeyboard: boolean) => void;
}

/** The kinds in the fan's order, from the left of its arc: back up, then what conditions take, then remove. */
const KINDS: ReadonlyArray<{ kind: RecoveryRuleKind; label: MessageKey; icon: React.ReactNode }> = [
  { kind: 'full', label: 'recoveryEditor.kind.full', icon: <BatteryFull /> },
  { kind: 'amount', label: 'recoveryEditor.kind.amount', icon: <Plus /> },
  { kind: 'share', label: 'recoveryEditor.kind.share', icon: <span className="atlas-rc-fan-glyph" aria-hidden="true">{'½'}</span> },
  { kind: 'set', label: 'recoveryEditor.kind.set', icon: <Equal /> },
  { kind: 'spend', label: 'recoveryEditor.kind.spend', icon: <ArrowLeftRight /> },
  { kind: 'step', label: 'recoveryEditor.kind.step', icon: <ChevronsDown /> },
  { kind: 'clear', label: 'recoveryEditor.kind.clear', icon: <Eraser /> },
];

/** Why a kind cannot be chosen for `target`, or null where it can. */
function refusal(kind: RecoveryRuleKind, target: RecoveryTarget, canSpend: boolean): string | null {
  if (!kindFits(kind, target)) return t(target.kind === 'condition' ? 'recoveryEditor.kindNotConditions' : 'recoveryEditor.kindOnlyConditions');
  if (kind === 'spend' && !canSpend) return t('recoveryEditor.kindNoSource');
  return null;
}

/**
 * The round buttons that fan out over a picked metric: the kind of rule the selected button
 * applies to it (the one it has is pressed), and Remove. Kinds that do not fit the metric stay in
 * place, inert, and say why.
 */
export function RuleFan({ place, target, rule, metric, button, canSpend, focusFirst, onChoose }: RuleFanProps): React.ReactElement {
  const buttons: FanButton[] = KINDS.map(({ kind, label, icon }) => {
    const refused = refusal(kind, target, canSpend);
    return {
      label: refused ?? t(label),
      icon,
      pressed: rule?.does === kind,
      disabled: refused !== null,
      onClick: (fromKeyboard) => onChoose(kind, fromKeyboard),
    };
  });
  buttons.push({ label: t('recoveryEditor.kind.remove', { button }), icon: <Trash2 />, danger: true, onClick: (fromKeyboard) => onChoose('remove', fromKeyboard) });
  // The rule's own kind takes focus as the fan opens from the keyboard; it stays where the fan opened
  const [focusIndex] = useState(() => Math.max(0, KINDS.findIndex(({ kind }) => kind === rule?.does)));

  return (
    <div className="atlas-rc-fan" onPointerDown={(event) => event.stopPropagation()}>
      <RadialFan buttons={buttons} spots={place.spots} x={place.x} y={place.y} label={metric} focusFirst={focusFirst} focusIndex={focusIndex} />
    </div>
  );
}
