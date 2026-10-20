import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_OUT_CONTROL_POINTS } from '../../../../utils/motion';
import { RuleCard, type RuleCardProps } from './RuleCard';
import { placeRuleCard, type Box, type RuleFanPlace } from './rulePlacement';

/** The card's width (recovery-pane.scss). */
export const RULE_CARD_WIDTH = 304;

const CARD_MOTION = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.24, ease: EASE_OUT_CONTROL_POINTS, delay: 0.06 } },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12, ease: EASE_OUT_CONTROL_POINTS } },
} as const;

interface RuleCardLayerProps {
  metricBox: Box;
  frame: Box;
  fan: RuleFanPlace | null;
  card: RuleCardProps;
}

/**
 * The rule card where it opens under the picked metric, growing out of it as the Resources tab's
 * card does. A press on it stays on it: the stage would take it for a press beside the metric.
 */
export function RuleCardLayer({ metricBox, frame, fan, card }: RuleCardLayerProps): React.ReactElement {
  const place = placeRuleCard(RULE_CARD_WIDTH, metricBox, frame, fan);
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  // The card opens under the metric, which may be near the bottom of the dialog: it comes into view
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [still]);
  return (
    <motion.div ref={ref} className="atlas-rc-card-layer" style={{ left: place.left, top: place.top }} {...CARD_MOTION}
      onPointerDown={(event) => event.stopPropagation()}>
      <RuleCard {...card} />
    </motion.div>
  );
}
