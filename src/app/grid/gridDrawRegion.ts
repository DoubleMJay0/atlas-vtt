import type { GridBounds, GridLineType } from './gridLineStyle';

/**
 * What the Canvas renderer may draw of a grid at once. A WebGL renderer draws the grid with a
 * shader, at a cost that does not depend on the map (`GridMesh`); the Canvas renderer draws it as
 * a Graphics, where solid lines cost one stroke per row and column, dashed lines a segment per cell
 * and dotted ones a marker per vertex: on a gigapixel map with small cells that is millions of
 * shapes, which a window never finishes drawing. Past `MAX_GRID_MARKS` such a grid is drawn solid
 * instead: a dot a pixel apart is a line anyway.
 */

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Marks (dashes or dots) a grid may hold before the Canvas renderer draws it solid instead. */
export const MAX_GRID_MARKS = 20_000;

/** About how many marks `lineType` draws in `region` with cells of `size`: dots one per vertex, dashes two per cell. */
export function marksIn(region: GridBounds, size: number, lineType: GridLineType): number {
  if (!(size > 0)) return Infinity;
  const columns = Math.max(0, (region.maxX - region.minX) / size + 1);
  const rows = Math.max(0, (region.maxY - region.minY) / size + 1);
  return columns * rows * (lineType === 'dashed' ? 2 : 1);
}
