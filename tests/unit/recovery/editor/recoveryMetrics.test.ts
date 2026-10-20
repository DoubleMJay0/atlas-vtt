import { describe, expect, it } from 'vitest';
import { conditionMetrics, metricKey, numberFields, sheetMetrics } from '../../../../src/app/recovery/editor/recoveryMetrics';
import { ADVENTURER, CONDITIONS, RESOURCES } from '../../../fixtures/recoveryFixtures';

describe('the metrics of a card', () => {
  const { metrics, byBlock, refused } = sheetMetrics(ADVENTURER, RESOURCES);

  it('finds the resources by the fields their blocks show, the header first, and every Counters block', () => {
    expect(metrics.map((metric) => [metric.blockId, metricKey(metric.target), metric.label])).toEqual([
      ['header-hp', 'resource:hp', 'HP'],
      ['track001', 'resource:stress', 'Stress'],
      ['countr01', 'counters:hit_dice', 'Hit Dice'],
      ['countr02', 'counters:features', 'Features'],
    ]);
    expect(byBlock.get('countr02')?.target).toEqual({ kind: 'counters', field: 'features', rows: 'all' });
  });

  it('refuses numbers no resource reads, and a static value', () => {
    expect([...refused].sort()).toEqual(['statac01', 'statcn01']);
  });

  it('reads a dotted resource field by its first key', () => {
    const scores = sheetMetrics(ADVENTURER, [{ ...RESOURCES[1]!, key: 'grit', field: 'con.0' }]);
    expect(scores.metrics.map((metric) => metric.blockId)).toEqual(['statcn01', 'countr01', 'countr02']);
  });

  it('offers the valued conditions only', () => {
    expect(conditionMetrics(CONDITIONS).map((chip) => chip.label)).toEqual(['Exhaustion', 'Frightened']);
  });

  it('names the number fields a formula may use', () => {
    expect(numberFields(ADVENTURER).map((field) => field.key)).toEqual(['level', 'hp', 'ac', 'con', 'stress']);
  });
});
