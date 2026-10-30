import { describe, expect, it } from 'vitest';
import { cellsOf, drawnPerCell, drawRegionFor, marksIn, MAX_GRID_MARKS, MAX_NUMBERED_CELLS, needsRedraw } from '../../../src/app/grid/gridDrawRegion';

describe('how much of a grid is drawn at once', () => {
  const map = { minX: -70, minY: -70, maxX: 31692, maxY: 31692 };

  it('draws solid lines whole and the per-cell styles for the view with a margin, clipped to the map', () => {
    expect(drawnPerCell('solid')).toBe(false);
    expect(drawnPerCell('dashed')).toBe(true);
    expect(drawnPerCell('dotted')).toBe(true);
    expect(drawRegionFor(map, { x: 10000, y: 12000, width: 2000, height: 1000 })).toEqual({ minX: 8000, minY: 11000, maxX: 14000, maxY: 14000 });
    expect(drawRegionFor(map, { x: -5000, y: 30000, width: 2000, height: 1000 })).toEqual({ minX: -70, minY: 29000, maxX: -1000, maxY: 31692 });
  });

  it('counts the marks a region holds, and draws solid where the view alone holds too many', () => {
    const region = drawRegionFor(map, { x: 0, y: 0, width: 6000, height: 3000 });
    expect(marksIn(region, 70, 'dotted')).toBeLessThan(MAX_GRID_MARKS);
    expect(marksIn(region, 8, 'dotted')).toBeGreaterThan(MAX_GRID_MARKS);
    expect(marksIn(region, 70, 'dashed')).toBe(2 * marksIn(region, 70, 'dotted'));
    expect(marksIn(region, 0, 'dotted')).toBe(Infinity);
  });

  it('leaves the numbers off a map with more cells than they could ever be read on', () => {
    expect(cellsOf(31622, 31622, 70)).toBeGreaterThan(MAX_NUMBERED_CELLS);
    expect(cellsOf(8000, 6000, 70)).toBeLessThan(MAX_NUMBERED_CELLS);
  });

  it('draws again once the view leaves the drawn region or the zoom moves away from it', () => {
    const drawn = drawRegionFor(map, { x: 10000, y: 12000, width: 2000, height: 1000 });
    expect(needsRedraw(drawn, 1, { x: 10500, y: 12200, width: 2000, height: 1000 }, 1)).toBe(false);
    expect(needsRedraw(drawn, 1, { x: 7000, y: 12000, width: 2000, height: 1000 }, 1)).toBe(true);
    expect(needsRedraw(drawn, 1, { x: 10000, y: 12000, width: 2000, height: 1000 }, 1.4)).toBe(false);
    expect(needsRedraw(drawn, 1, { x: 10000, y: 12000, width: 2000, height: 1000 }, 1.5)).toBe(true);
    expect(needsRedraw(drawn, 1, { x: 10000, y: 12000, width: 2000, height: 1000 }, 0.6)).toBe(true);
  });
});
