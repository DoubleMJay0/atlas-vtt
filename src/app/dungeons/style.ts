/**
 * How a dungeon is drawn. Stroke widths are in pixels at 30 px per cell (the reference scale) and
 * scale with the cell size; distances are in cells. Colours are `#rrggbb`. Nothing is written on
 * a map, so a style has no fonts. The GM never edits one: they pick a whole look from
 * `DUNGEON_STYLES` (`styleCatalog.ts`), and only its id is stored.
 */

/**
 * The two ways a look is drawn. Stone & shadow paints the plan as built: natural rock fading into
 * the vellum, a course of dressed wall blocks, flagstones and one light casting every shadow.
 * Engraved cuts it as a copperplate: burin lines whose width carries the tone, in two colours.
 */
export type ArtDirection = 'stone' | 'engraved';

/**
 * How the floor is laid: irregular flagstones on the cell lines, long ashlar courses, rounded
 * cobbles, or one square slab a cell.
 */
export type FloorPattern = 'flagstone' | 'ashlar' | 'cobble' | 'slab';

export interface DungeonStyle {
  direction: ArtDirection;
  /** `rock` is the natural rock round the walls (Stone & shadow; Engraved cuts it in ink). */
  colors: { ink: string; rock: string; water: string; floor: string; paper: string };
  /** `thick` is the wall's ink outside the floor: the scene's walls lie on its middle. */
  strokes: { thin: number; normal: number; thick: number };
  /** Multiplied onto the floor, so it darkens whatever the floor's colour; white is no shadow. */
  shadow: { color: string; strength: number };
  /** How far the rock (or its engraving) reaches past the walls, in cells. */
  surround: { reach: number };
  floor: FloorPattern;
  /** What pools hold where it is not water. */
  liquid?: 'lava';
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
  secrets: boolean;
  /** Only the style's ink and paper (Stone & shadow: tones between the two). */
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
  secrets: true,
  monochrome: false,
};
