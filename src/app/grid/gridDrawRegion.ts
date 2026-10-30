import type { GridBounds, GridLineType } from './gridLineStyle';

/**
 * How much of a grid is drawn at once. Solid lines cost one stroke per row and column, so a map's
 * whole grid is drawn in one go. Dashed lines cost a segment per cell and dotted ones a marker per
 * vertex: on a gigapixel map with small cells that is millions of shapes, which a window never
 * finishes drawing. Those styles are drawn for the part of the map in view, with a margin so a pan
 * does not redraw every frame, and drawn again once the view leaves that part or the zoom changes
 * enough. Where even the view holds more marks than `MAX_GRID_MARKS` (zoomed far out), the grid is
 * drawn solid instead: a dot a pixel apart is a line anyway. Cell numbers are one text each and are
 * left out of a map with more than `MAX_NUMBERED_CELLS` cells.
 */

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Marks (dashes or dots) a drawn region may hold before the grid is drawn solid instead. */
export const MAX_GRID_MARKS = 20_000;
/** Cells a map may have before its numbers are left out. */
export const MAX_NUMBERED_CELLS = 100_000;
/** How far past the view a region reaches, in views: a pan of a screen's width stays inside it. */
const REGION_MARGIN = 1;
/** A zoom this many times in or out of the drawn one draws the region again, since its marks are sized for the drawn zoom. */
const REDRAW_ZOOM_RATIO = 1.5;

/** Whether `lineType` is drawn per cell rather than per line. */
export function drawnPerCell(lineType: GridLineType): boolean {
  return lineType !== 'solid';
}

/** The part of `bounds` to draw for a view: the view with a margin of `REGION_MARGIN` views on every side, clipped to the bounds. */
export function drawRegionFor(bounds: GridBounds, view: WorldRect): GridBounds {
  const marginX = view.width * REGION_MARGIN;
  const marginY = view.height * REGION_MARGIN;
  return {
    minX: Math.max(bounds.minX, view.x - marginX),
    minY: Math.max(bounds.minY, view.y - marginY),
    maxX: Math.min(bounds.maxX, view.x + view.width + marginX),
    maxY: Math.min(bounds.maxY, view.y + view.height + marginY),
  };
}

/** About how many marks `lineType` draws in `region` with cells of `size`: dots one per vertex, dashes two per cell. */
export function marksIn(region: GridBounds, size: number, lineType: GridLineType): number {
  if (!(size > 0)) return Infinity;
  const columns = Math.max(0, (region.maxX - region.minX) / size + 1);
  const rows = Math.max(0, (region.maxY - region.minY) / size + 1);
  return columns * rows * (lineType === 'dashed' ? 2 : 1);
}

/** About how many cells of `size` a map of `width` × `height` holds. */
export function cellsOf(width: number, height: number, size: number): number {
  return size > 0 ? (width / size) * (height / size) : Infinity;
}

/** Whether a view has left the drawn region, or the zoom moved away from the one it was drawn at. */
export function needsRedraw(drawn: GridBounds, drawnZoom: number, view: WorldRect, zoom: number): boolean {
  const ratio = zoom / drawnZoom;
  if (ratio >= REDRAW_ZOOM_RATIO || ratio <= 1 / REDRAW_ZOOM_RATIO) return true;
  return view.x < drawn.minX || view.y < drawn.minY || view.x + view.width > drawn.maxX || view.y + view.height > drawn.maxY;
}
