import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../../../../utils/cn';
import { EASE_OUT_CONTROL_POINTS } from '../../../../utils/motion';
import { t } from '../../../../i18n';
import { LabelTooltip } from '../../../../packages/components/primitives/tooltip';
import { FAN_TIMING } from '../fan/RadialFan';

/** What a metric's spot shows of the selected button's rule on it, and how it is pressed. */
export interface SpotProps {
  /** The block's id, or `condition:<id>` for a chip. */
  spotId: string;
  /** The metric's name. */
  label: string;
  /** The rule's badge, or null where the button leaves the metric alone. */
  badge: string | null;
  /** The button the badge belongs to: another button's badge swaps in. */
  badgeOf: string;
  /** Its place among the metrics, which staggers the badges as the fan staggers its buttons. */
  order: number;
  picked: boolean;
  /** Offered as what a Spend rule spends. */
  source: boolean;
  /** The one spot of the card the Tab key stops at. */
  tabbable: boolean;
  register: (spotId: string, element: HTMLElement | null) => void;
  onPick: (spotId: string, fromKeyboard: boolean) => void;
  onKeyDown: (spotId: string, event: React.KeyboardEvent) => void;
  onFocus: (spotId: string) => void;
}

/** The badges move in the fan's timing; a badge keeps its place while another button's takes it. */
function badgeMotion(order: number): React.ComponentProps<typeof motion.span> {
  return {
    initial: { opacity: 0, y: 4, scale: 0.8 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: FAN_TIMING.enter, ease: EASE_OUT_CONTROL_POINTS, delay: order * FAN_TIMING.stagger } },
    exit: { opacity: 0, y: -4, scale: 0.8, transition: { duration: FAN_TIMING.exit, ease: EASE_OUT_CONTROL_POINTS } },
  };
}

/** The rule's badge on a metric, swapped with motion when the selected button changes. */
export function RuleBadge({ badge, badgeOf, order }: Pick<SpotProps, 'badge' | 'badgeOf' | 'order'>): React.ReactElement {
  return (
    <span className="atlas-rc-badge-slot" aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        {badge !== null && <motion.span key={`${badgeOf}:${badge}`} className="atlas-rc-badge" {...badgeMotion(order)}>{badge}</motion.span>}
      </AnimatePresence>
    </span>
  );
}

/**
 * A metric of the card in the recovery editor: a button laid over its block (by the chrome's
 * overlay, so the block's box does not change), with a ring on hover and the selected button's
 * rule as a badge on its corner.
 */
export function MetricSpot(props: SpotProps): React.ReactElement {
  const { spotId, label, badge, picked, source, tabbable, register, onPick, onKeyDown, onFocus } = props;
  return (
    <>
      <button
        ref={(element) => register(spotId, element)}
        type="button"
        className={cn('atlas-rc-spot', picked && 'atlas-picked', source && 'atlas-source', badge !== null && 'atlas-restored')}
        tabIndex={tabbable ? 0 : -1}
        aria-label={badge === null ? t('recoveryEditor.metricUnset', { metric: label }) : t('recoveryEditor.metricRule', { metric: label, rule: badge })}
        aria-expanded={picked}
        // A press on the card would otherwise close the fan this opens
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => onPick(spotId, event.detail === 0)}
        onKeyDown={(event) => onKeyDown(spotId, event)}
        onFocus={() => onFocus(spotId)}
      />
      <RuleBadge {...props} />
    </>
  );
}

/** A block that shows a number no token resource reads: it says why it cannot be picked. */
export function RefusedSpot(): React.ReactElement {
  return (
    <LabelTooltip label={t('recoveryEditor.notResource')}>
      <span className="atlas-rc-spot atlas-rc-spot--refused" />
    </LabelTooltip>
  );
}
