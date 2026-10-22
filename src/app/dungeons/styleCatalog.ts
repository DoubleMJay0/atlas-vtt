import type { DungeonStyle } from './style';

/**
 * The looks a GM picks a dungeon's drawing from: each a whole, its colours, strokes, shadow,
 * surroundings and grid chosen together, so every one stays legible on a table at 100 px per
 * cell under tokens. Atlas' own names and values. Ids are stored in the GM's settings: never
 * rename or reuse one.
 */

export type DungeonStyleId =
  | 'parchment'
  | 'masonry'
  | 'print'
  | 'stipple'
  | 'blueprint'
  | 'night'
  | 'sepia'
  | 'moss'
  | 'ice'
  | 'volcanic'
  | 'sandstone'
  | 'sewer'
  | 'vellum'
  | 'slate'
  | 'contrast'
  | 'drafting';

export interface DungeonStyleEntry {
  id: DungeonStyleId;
  style: DungeonStyle;
}

/** In the order the gallery shows them. */
export const DUNGEON_STYLES: readonly DungeonStyleEntry[] = [
  {
    id: 'parchment',
    style: {
      colors: { ink: '#1a1612', shading: '#c8bfae', water: '#a9aea6', floor: '#f6eddc', paper: '#ebdfcb' },
      strokes: { thin: 0.5, hatching: 1.2, normal: 1.5, thick: 3.5 },
      shadow: { color: '#9a958e', distance: 0.15 },
      hatching: { mode: 'hatching', strokes: 3, size: 0.3, distance: 0.5 },
      grid: { weight: 1, strength: 0.6 },
    },
  },
  {
    id: 'masonry',
    style: {
      colors: { ink: '#2b231c', shading: '#bdbab0', water: '#869a9c', floor: '#e4e0cc', paper: '#d8d3c0' },
      strokes: { thin: 0.5, hatching: 0.5, normal: 1.5, thick: 3 },
      shadow: { color: '#b19f95', distance: 0.3 },
      hatching: { mode: 'stonework', strokes: 3, size: 0.4, distance: 0.6 },
      grid: { weight: 1, strength: 0.5 },
    },
  },
  {
    id: 'print',
    style: {
      colors: { ink: '#111111', shading: '#e2e2e2', water: '#d4dde3', floor: '#ffffff', paper: '#ffffff' },
      strokes: { thin: 0.5, hatching: 0.9, normal: 1.3, thick: 3 },
      shadow: { color: '#ffffff', distance: 0.1 },
      hatching: { mode: 'hatching', strokes: 3, size: 0.28, distance: 0.45 },
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'stipple',
    style: {
      colors: { ink: '#000000', shading: '#000000', water: '#d9e4e2', floor: '#ffffff', paper: '#f3f3f1' },
      strokes: { thin: 0.3, hatching: 0.3, normal: 1, thick: 2 },
      shadow: { color: '#ffffff', distance: 0.2 },
      hatching: { mode: 'dots', strokes: 4, size: 0.6, distance: 0.9 },
      grid: { weight: 1, strength: 0.5 },
    },
  },
  {
    id: 'blueprint',
    style: {
      colors: { ink: '#e6f0ff', shading: '#1d4a8a', water: '#2f6db5', floor: '#2358a0', paper: '#173d75' },
      strokes: { thin: 0.5, hatching: 0.7, normal: 1.2, thick: 2.5 },
      shadow: { color: '#7d93b5', distance: 0.15 },
      hatching: { mode: 'hatching', strokes: 4, size: 0.3, distance: 0.5 },
      grid: { weight: 0.9, strength: 0.35 },
    },
  },
  {
    id: 'night',
    style: {
      colors: { ink: '#d8d4cc', shading: '#24262b', water: '#2f4656', floor: '#3a3d44', paper: '#1b1d21' },
      strokes: { thin: 0.5, hatching: 0.9, normal: 1.4, thick: 3 },
      shadow: { color: '#6f7178', distance: 0.15 },
      hatching: { mode: 'hatching', strokes: 3, size: 0.3, distance: 0.5 },
      grid: { weight: 1, strength: 0.4 },
    },
  },
  {
    id: 'sepia',
    style: {
      colors: { ink: '#3f2614', shading: '#bf9d6c', water: '#9c8c68', floor: '#ecd9b4', paper: '#d8bd8f' },
      strokes: { thin: 0.5, hatching: 1.1, normal: 1.5, thick: 3.5 },
      shadow: { color: '#a4855e', distance: 0.2 },
      hatching: { mode: 'hatching', strokes: 4, size: 0.32, distance: 0.55 },
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'moss',
    style: {
      colors: { ink: '#1f2a1b', shading: '#8a9a62', water: '#5d8566', floor: '#dfe2c6', paper: '#aab58a' },
      strokes: { thin: 0.5, hatching: 0.6, normal: 1.5, thick: 3 },
      shadow: { color: '#9aa486', distance: 0.25 },
      hatching: { mode: 'stonework', strokes: 3, size: 0.45, distance: 0.6 },
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'ice',
    style: {
      colors: { ink: '#1c3a55', shading: '#a7c7dc', water: '#86bcd9', floor: '#f2f8fb', paper: '#d3e5ef' },
      strokes: { thin: 0.4, hatching: 0.8, normal: 1.3, thick: 2.8 },
      shadow: { color: '#a9c2d4', distance: 0.2 },
      hatching: { mode: 'hatching', strokes: 2, size: 0.4, distance: 0.55 },
      grid: { weight: 1, strength: 0.4 },
    },
  },
  {
    id: 'volcanic',
    style: {
      colors: { ink: '#efe2cf', shading: '#2a2220', water: '#e0531b', floor: '#4a3d38', paper: '#1d1716' },
      strokes: { thin: 0.5, hatching: 0.8, normal: 1.4, thick: 3 },
      shadow: { color: '#6e625e', distance: 0.15 },
      hatching: { mode: 'hatching', strokes: 3, size: 0.3, distance: 0.5 },
      grid: { weight: 1, strength: 0.3 },
    },
  },
  {
    id: 'sandstone',
    style: {
      colors: { ink: '#4f2f17', shading: '#d5a66b', water: '#5f9e9a', floor: '#f4e3c1', paper: '#e6c590' },
      strokes: { thin: 0.5, hatching: 0.7, normal: 1.4, thick: 3 },
      shadow: { color: '#c39a6b', distance: 0.25 },
      hatching: { mode: 'bricks', strokes: 3, size: 0.55, distance: 0.55 },
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'sewer',
    style: {
      colors: { ink: '#1b2016', shading: '#6c7250', water: '#77823f', floor: '#cfcdb0', paper: '#868a6a' },
      strokes: { thin: 0.5, hatching: 0.6, normal: 1.5, thick: 3 },
      shadow: { color: '#8a8b72', distance: 0.25 },
      hatching: { mode: 'bricks', strokes: 3, size: 0.4, distance: 0.5 },
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'vellum',
    style: {
      colors: { ink: '#5e1220', shading: '#e0c9b0', water: '#bcc3c4', floor: '#fbf4e6', paper: '#f0e3cb' },
      strokes: { thin: 0.5, hatching: 1, normal: 1.4, thick: 3.2 },
      shadow: { color: '#c9b49a', distance: 0.15 },
      hatching: { mode: 'hatching', strokes: 3, size: 0.28, distance: 0.45 },
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'slate',
    style: {
      colors: { ink: '#0b0c0d', shading: '#7d7665', water: '#6f9a98', floor: '#8b939b', paper: '#b6bdab' },
      strokes: { thin: 0.5, hatching: 1, normal: 1.5, thick: 2 },
      shadow: { color: '#cbcbcb', distance: 0.2 },
      hatching: { mode: 'bricks', strokes: 4, size: 0.4, distance: 0.67 },
      grid: { weight: 1, strength: 0.5 },
    },
  },
  {
    id: 'contrast',
    style: {
      colors: { ink: '#000000', shading: '#000000', water: '#a9bccb', floor: '#ffffff', paper: '#000000' },
      strokes: { thin: 0.5, hatching: 1, normal: 1.6, thick: 3 },
      shadow: { color: '#ffffff', distance: 0.1 },
      hatching: { mode: 'none', strokes: 3, size: 0.3, distance: 0.6 },
      grid: { weight: 1, strength: 0.6 },
    },
  },
  {
    id: 'drafting',
    style: {
      colors: { ink: '#0d1015', shading: '#ececec', water: '#e6eef3', floor: '#ffffff', paper: '#fcfcfc' },
      strokes: { thin: 0.5, hatching: 0.5, normal: 1, thick: 2 },
      shadow: { color: '#ffffff', distance: 0.1 },
      hatching: { mode: 'bricks', strokes: 2, size: 0.5, distance: 0.333 },
      grid: { weight: 1, strength: 0.5 },
    },
  },
];

export const DEFAULT_STYLE_ID: DungeonStyleId = 'parchment';

const BY_ID = new Map(DUNGEON_STYLES.map(entry => [entry.id, entry.style] as const));

export function isDungeonStyleId(value: unknown): value is DungeonStyleId {
  return typeof value === 'string' && BY_ID.has(value as DungeonStyleId);
}

/** The style of an id; the default's for one Atlas does not know. */
export function dungeonStyle(id: string): DungeonStyle {
  return BY_ID.get(id as DungeonStyleId) ?? BY_ID.get(DEFAULT_STYLE_ID)!;
}
