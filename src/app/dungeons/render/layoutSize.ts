import type { DungeonModel } from '../model';
import type { DungeonView } from '../style';
import { DEFAULT_VIEW } from '../style';
import { visibleDungeon } from './visibleDungeon';

/** Largest side a map image may have (WebP's limit, as for imported maps). */
export const MAX_MAP_SIDE = 16_383;
/** Largest number of pixels a map image may have. */
export const MAX_MAP_PIXELS = 144_000_000;
/** Whole cells of paper around the floors: room for the hatching, its strokes and the exits. */
export const MAP_MARGIN_CELLS = 2;
export const DEFAULT_PX_PER_CELL = 100;

/** Where a map image lies on the grid: its pixel (0, 0) is the corner of cell `originCell`. */
export interface MapLayout {
  originCell: { x: number; y: number };
  /** In cells. */
  cellsWide: number;
  cellsHigh: number;
  widthPx: number;
  heightPx: number;
  pxPerCell: number;
}

export function mapLayout(model: DungeonModel, pxPerCell: number, view: Pick<DungeonView, 'secrets'> = DEFAULT_VIEW): MapLayout {
  const { bounds } = visibleDungeon(model, view);
  const minX = Math.floor(bounds.minX) - MAP_MARGIN_CELLS;
  const minY = Math.floor(bounds.minY) - MAP_MARGIN_CELLS;
  const cellsWide = Math.ceil(bounds.maxX) + MAP_MARGIN_CELLS - minX;
  const cellsHigh = Math.ceil(bounds.maxY) + MAP_MARGIN_CELLS - minY;
  return {
    originCell: { x: minX, y: minY },
    cellsWide,
    cellsHigh,
    widthPx: Math.round(cellsWide * pxPerCell),
    heightPx: Math.round(cellsHigh * pxPerCell),
    pxPerCell,
  };
}

export function mapPixelSize(model: DungeonModel, pxPerCell: number, view: Pick<DungeonView, 'secrets'> = DEFAULT_VIEW): { width: number; height: number } {
  const layout = mapLayout(model, pxPerCell, view);
  return { width: layout.widthPx, height: layout.heightPx };
}

/** The most pixels per cell (whole pixels) that keep the image within both limits. */
export function maxPxPerCell(model: DungeonModel, view: Pick<DungeonView, 'secrets'> = DEFAULT_VIEW): number {
  const { cellsWide, cellsHigh } = mapLayout(model, 1, view);
  const bySide = MAX_MAP_SIDE / Math.max(cellsWide, cellsHigh);
  const byArea = Math.sqrt(MAX_MAP_PIXELS / (cellsWide * cellsHigh));
  return Math.max(1, Math.floor(Math.min(bySide, byArea)));
}

/** The cell size to draw a map at: the one asked for, or less where the limits demand it. */
export function suggestedPxPerCell(model: DungeonModel, wanted = DEFAULT_PX_PER_CELL, view: Pick<DungeonView, 'secrets'> = DEFAULT_VIEW): number {
  return Math.max(1, Math.min(Math.round(wanted), maxPxPerCell(model, view)));
}
