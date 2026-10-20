/**
 * Where a metric's rule fan and rule card open on the recovery editor's stage: the fan as an arc
 * over the metric (under it where the stage has no room above), the card under the metric, or
 * under the fan where that hangs below. Pure: every box is in px of the stage.
 */

import { fanSpots, type FanSpot } from '../fan/fanArc';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RuleFanPlace {
  /** The fan's origin. */
  x: number;
  y: number;
  side: 'above' | 'below';
  spots: FanSpot[];
  /** How far the fan's buttons reach above and below its origin's line. */
  top: number;
  bottom: number;
}

export interface RuleCardPlace {
  left: number;
  top: number;
}

/** The arc: distance of the buttons from the origin and the angle between two of them. */
export const RULE_FAN_RADIUS = 112;
const RULE_FAN_SPREAD_DEG = 21;
/** Half a fan button (radial-fan.scss: 34px). */
const BUTTON_HALF = 17;
/** Room between the metric and the fan, the card and the stage's sides. */
export const RULE_GAP = 8;

const clamp = (value: number, least: number, most: number): number => (least > most ? (least + most) / 2 : Math.max(least, Math.min(most, value)));

/** How far an arc may turn away from a side it would pass, in degrees, and in what steps it tries. */
const MOST_TURN_DEG = 80;
const TURN_STEP_DEG = 5;

/** Whether every button of an arc from (`x`, `y`) lies between the frame's sides and off the metric. */
function fits(spots: readonly FanSpot[], x: number, y: number, frame: Box, metric: Box): boolean {
  return spots.every((spot) => {
    const [left, right, top, bottom] = [x + spot.x - BUTTON_HALF, x + spot.x + BUTTON_HALF, y + spot.y - BUTTON_HALF, y + spot.y + BUTTON_HALF];
    const onMetric = left < metric.right && right > metric.left && top < metric.bottom && bottom > metric.top;
    return left >= frame.left + RULE_GAP && right <= frame.right - RULE_GAP && !onMetric;
  });
}

/**
 * The fan of `count` buttons over the metric `metric`, inside the stage `frame`: an arc centred
 * over the metric, under it where the frame has no room above, and turned away from a side it
 * would pass (a chip at the stage's edge), so it stays around its metric.
 */
export function placeRuleFan(count: number, metric: Box, frame: Box): RuleFanPlace {
  const reach = RULE_FAN_RADIUS + BUTTON_HALF;
  const above = metric.top - RULE_GAP / 2 - reach >= frame.top;
  const y = above ? metric.top - RULE_GAP / 2 : metric.bottom + RULE_GAP / 2;
  const centred = (metric.left + metric.right) / 2;
  const base = above ? -90 : 90;
  const arcAt = (centreDeg: number): FanSpot[] => fanSpots(count, { radius: RULE_FAN_RADIUS, centreDeg, spreadDeg: RULE_FAN_SPREAD_DEG });
  let arc: FanSpot[] | null = null;
  for (let turn = 0; turn <= MOST_TURN_DEG && !arc; turn += TURN_STEP_DEG) {
    arc = [arcAt(base + turn), arcAt(base - turn)].find((spots) => fits(spots, centred, y, frame, metric)) ?? null;
  }
  // Where no turn fits (a stage narrower than the fan), the arc keeps its shape and moves in
  const x = arc ? centred : clamp(centred, frame.left + reach + RULE_GAP, frame.right - reach - RULE_GAP);
  const shown = arc ?? arcAt(base);
  // Both ways the first button stands at the left: an arc below runs the other way round
  const spots = above ? shown : [...shown].reverse();
  const ys = spots.map((spot) => spot.y);
  return { x, y, side: above ? 'above' : 'below', spots, top: y + Math.min(...ys) - BUTTON_HALF, bottom: y + Math.max(...ys) + BUTTON_HALF };
}

/** The card of `width` under the metric, or under the fan where it reaches lower (hung below, or turned). */
export function placeRuleCard(width: number, metric: Box, frame: Box, fan: RuleFanPlace | null): RuleCardPlace {
  const under = Math.max(metric.bottom, fan?.bottom ?? metric.bottom);
  const left = clamp((metric.left + metric.right) / 2 - width / 2, frame.left + RULE_GAP, frame.right - RULE_GAP - width);
  return { left, top: under + RULE_GAP };
}
