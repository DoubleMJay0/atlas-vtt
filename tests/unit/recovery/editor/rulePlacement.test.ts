import { describe, expect, it } from 'vitest';
import { placeRuleCard, placeRuleFan, RULE_GAP } from '../../../../src/app/react/components/collection-settings/recovery/rulePlacement';

const FRAME = { left: 0, top: 0, right: 800, bottom: 900 };

describe('where the rule fan and card open', () => {
  it('turn away from a side for a chip at the stage\'s edge, and move in where no turn fits', () => {
    const chip = { left: 10, top: 600, right: 90, bottom: 626 };
    const fan = placeRuleFan(8, chip, FRAME);
    expect(fan.x).toBe(50);
    for (const spot of fan.spots) expect(fan.x + spot.x - 17).toBeGreaterThanOrEqual(RULE_GAP);
    // No turn keeps the arc inside a stage this narrow: it moves to the middle
    const narrow = placeRuleFan(8, chip, { ...FRAME, right: 150 });
    expect(narrow.x).toBe(75);
  });

  it('fan out over a metric with room above, the card under it', () => {
    const metric = { left: 100, top: 400, right: 500, bottom: 420 };
    const fan = placeRuleFan(8, metric, FRAME);
    expect(fan.side).toBe('above');
    expect(fan.x).toBe(300);
    expect(fan.bottom).toBeLessThan(metric.top);
    expect(fan.top).toBeGreaterThanOrEqual(FRAME.top);
    // Neighbours never touch: 34 px buttons
    for (let i = 1; i < fan.spots.length; i++) {
      expect(Math.hypot(fan.spots[i]!.x - fan.spots[i - 1]!.x, fan.spots[i]!.y - fan.spots[i - 1]!.y)).toBeGreaterThan(36);
    }
    expect(placeRuleCard(304, metric, FRAME, fan)).toEqual({ left: 148, top: 420 + RULE_GAP });
  });

  it('hang under a metric at the top, the card under the fan', () => {
    const metric = { left: 0, top: 20, right: 200, bottom: 40 };
    const fan = placeRuleFan(8, metric, FRAME);
    expect(fan.side).toBe('below');
    // No button lies on the metric
    for (const spot of fan.spots) {
      const [x, y] = [fan.x + spot.x, fan.y + spot.y];
      expect(x - 17 >= metric.right || x + 17 <= metric.left || y - 17 >= metric.bottom || y + 17 <= metric.top).toBe(true);
    }
    // Inside the stage's side
    for (const spot of fan.spots) expect(fan.x + spot.x - 17).toBeGreaterThanOrEqual(RULE_GAP);
    const card = placeRuleCard(304, metric, FRAME, fan);
    expect(card.top).toBeGreaterThan(fan.bottom);
    expect(card.left).toBe(RULE_GAP);
  });
});
