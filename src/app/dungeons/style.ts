/**
 * How a dungeon is drawn. Stroke widths are in pixels at 30 px per cell (the reference scale) and
 * scale with the cell size; distances are in cells. Colours are `#rrggbb`. Nothing is written on
 * a map, so a style has no fonts. The GM never edits one: they pick a whole look from
 * `DUNGEON_STYLES` (`styleCatalog.ts`), and only its id is stored.
 */

export type HatchingMode = 'hatching' | 'stonework' | 'bricks' | 'dots' | 'none';

export interface DungeonStyle {
  colors: { ink: string; shading: string; water: string; floor: string; paper: string };
  strokes: { thin: number; hatching: number; normal: number; thick: number };
  /** Multiplied onto the floor, so it darkens whatever the floor's colour; white is no shadow. */
  shadow: { color: string; distance: number };
  hatching: { mode: HatchingMode; strokes: number; size: number; distance: number };
  /** The grid's line width as a share of the usual, and how strongly its ink shows over the floor (0..1). */
  grid: { weight: number; strength: number };
}

export type GridStyle = 'off' | 'dotted' | 'dashed' | 'solid' | 'broken';
export const GRID_STYLES: readonly GridStyle[] = ['off', 'dotted', 'dashed', 'solid', 'broken'];

/** What is shown, beside the style. */
export interface DungeonView {
  grid: GridStyle;
  /** Grid at half a cell. */
  smallTiles: boolean;
  water: boolean;
  props: boolean;
  shadow: boolean;
  /** The paper squares outside entrance and exit stairs. */
  exits: boolean;
  secrets: boolean;
  /** Only the style's ink and paper. */
  monochrome: boolean;
}

/** Pixels per cell all stroke widths are given for. */
export const REFERENCE_CELL_PX = 30;

export const DEFAULT_VIEW: DungeonView = {
  grid: 'dotted',
  smallTiles: false,
  water: true,
  props: true,
  shadow: true,
  exits: true,
  secrets: true,
  monochrome: false,
};
