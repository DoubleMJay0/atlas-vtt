/**
 * How a dungeon is drawn. Stroke widths are in pixels at 30 px per cell (the reference scale) and
 * scale with the cell size; distances are in cells. Colours are `#rrggbb`. Nothing is written on
 * a map, so a style has no fonts.
 */

export type HatchingMode = 'hatching' | 'stonework' | 'bricks' | 'dots' | 'none';

export interface DungeonStyle {
  colors: { ink: string; shading: string; water: string; floor: string; paper: string };
  strokes: { thin: number; hatching: number; normal: number; thick: number };
  /** A white shadow is no shadow. */
  shadow: { color: string; distance: number };
  hatching: { mode: HatchingMode; strokes: number; size: number; distance: number };
}

export type GridStyle = 'off' | 'dotted' | 'dashed' | 'solid' | 'broken';

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
  monochrome: boolean;
}

/** Bounds of the style dialog's fields. */
export const STYLE_LIMITS = {
  strokeThin: [0.1, 4],
  strokeHatching: [0.1, 4],
  strokeNormal: [0.1, 4],
  strokeThick: [0.1, 6],
  shadowDistance: [0.1, 0.5],
  hatchingStrokes: [2, 5],
  hatchingSize: [0.1, 1],
  hatchingDistance: [0.1, 1],
} as const;

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

export type StylePresetId = 'parchment' | 'masonry' | 'stipple' | 'drafting' | 'slate';

/** Atlas' own presets; ids are stored in settings and never renamed. */
export const STYLE_PRESETS: Record<StylePresetId, DungeonStyle> = {
  parchment: {
    colors: { ink: '#1a1612', shading: '#c8bfae', water: '#b0a99c', floor: '#f6eddc', paper: '#ebdfcb' },
    strokes: { thin: 0.5, hatching: 1.2, normal: 1.5, thick: 3.5 },
    shadow: { color: '#9a958e', distance: 0.15 },
    hatching: { mode: 'hatching', strokes: 3, size: 0.3, distance: 0.5 },
  },
  masonry: {
    colors: { ink: '#2b231c', shading: '#bdbab0', water: '#97685d', floor: '#e4e0cc', paper: '#d8d3c0' },
    strokes: { thin: 0.5, hatching: 0.5, normal: 1.5, thick: 3 },
    shadow: { color: '#b19f95', distance: 0.3 },
    hatching: { mode: 'stonework', strokes: 3, size: 0.4, distance: 0.6 },
  },
  stipple: {
    colors: { ink: '#000000', shading: '#000000', water: '#d9e4e2', floor: '#ffffff', paper: '#f3f3f1' },
    strokes: { thin: 0.3, hatching: 0.3, normal: 1, thick: 2 },
    shadow: { color: '#ffffff', distance: 0.2 },
    hatching: { mode: 'dots', strokes: 4, size: 0.6, distance: 0.9 },
  },
  drafting: {
    colors: { ink: '#0d1015', shading: '#ececec', water: '#e6eef3', floor: '#ffffff', paper: '#fcfcfc' },
    strokes: { thin: 0.5, hatching: 0.5, normal: 1, thick: 2 },
    shadow: { color: '#ffffff', distance: 0.1 },
    hatching: { mode: 'bricks', strokes: 2, size: 0.5, distance: 0.333 },
  },
  slate: {
    colors: { ink: '#0b0c0d', shading: '#7d7665', water: '#789898', floor: '#889098', paper: '#b6bdab' },
    strokes: { thin: 0.5, hatching: 1, normal: 1.5, thick: 2 },
    shadow: { color: '#cbcbcb', distance: 0.2 },
    hatching: { mode: 'bricks', strokes: 4, size: 0.4, distance: 0.67 },
  },
};

export const DEFAULT_STYLE_PRESET: StylePresetId = 'parchment';
