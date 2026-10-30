import { describe, expect, it } from 'vitest';
import { marksIn, MAX_GRID_MARKS } from '../../../src/app/grid/gridDrawRegion';

describe('the marks the Canvas renderer draws', () => {
  it('counts the marks a grid holds: dots one per vertex, dashes two per cell', () => {
    const region = { minX: 0, minY: 0, maxX: 6000, maxY: 3000 };
    expect(marksIn(region, 70, 'dotted')).toBeLessThan(MAX_GRID_MARKS);
    expect(marksIn(region, 8, 'dotted')).toBeGreaterThan(MAX_GRID_MARKS);
    expect(marksIn(region, 70, 'dashed')).toBe(2 * marksIn(region, 70, 'dotted'));
    expect(marksIn(region, 0, 'dotted')).toBe(Infinity);
  });
});
