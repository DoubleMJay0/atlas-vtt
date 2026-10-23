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
      direction: 'stone',
      colors: { ink: '#2a1c14', rock: '#a8977a', water: '#8fa79c', floor: '#f1e5c9', paper: '#d4c3a3' },
      strokes: { thin: 0.55, normal: 1.3, thick: 0.9 },
      shadow: { color: '#3b2a1c', strength: 0.55 },
      surround: { reach: 1.6 },
      floor: 'flagstone',
      grid: { weight: 0.9, strength: 0.5 },
    },
  },
  {
    id: 'masonry',
    style: {
      direction: 'stone',
      colors: { ink: '#22262b', rock: '#8f8b82', water: '#7f979c', floor: '#e6e3da', paper: '#b9b4a6' },
      strokes: { thin: 0.5, normal: 1.3, thick: 0.9 },
      shadow: { color: '#23272c', strength: 0.5 },
      surround: { reach: 1.5 },
      floor: 'ashlar',
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'print',
    style: {
      direction: 'engraved',
      colors: { ink: '#111111', rock: '#111111', water: '#d4dde3', floor: '#ffffff', paper: '#ffffff' },
      strokes: { thin: 0.5, normal: 1.3, thick: 2.1 },
      shadow: { color: '#111111', strength: 0.8 },
      surround: { reach: 1.5 },
      floor: 'flagstone',
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'stipple',
    style: {
      direction: 'engraved',
      colors: { ink: '#2a2c30', rock: '#2a2c30', water: '#cfdad8', floor: '#f8f6f0', paper: '#e4e1d8' },
      strokes: { thin: 0.4, normal: 1.1, thick: 1.9 },
      shadow: { color: '#2a2c30', strength: 0.7 },
      surround: { reach: 1.5 },
      floor: 'slab',
      grid: { weight: 0.9, strength: 0.4 },
    },
  },
  {
    id: 'blueprint',
    style: {
      direction: 'engraved',
      colors: { ink: '#e6f0ff', rock: '#e6f0ff', water: '#2f6db5', floor: '#2358a0', paper: '#173d75' },
      strokes: { thin: 0.5, normal: 1.2, thick: 1.9 },
      shadow: { color: '#0b1f40', strength: 0.8 },
      surround: { reach: 1.5 },
      floor: 'slab',
      grid: { weight: 0.9, strength: 0.35 },
    },
  },
  {
    id: 'night',
    style: {
      direction: 'stone',
      colors: { ink: '#d8d4cc', rock: '#2c2e33', water: '#2f4656', floor: '#3a3d44', paper: '#1b1d21' },
      strokes: { thin: 0.5, normal: 1.4, thick: 0.9 },
      shadow: { color: '#000000', strength: 0.6 },
      surround: { reach: 1.4 },
      floor: 'slab',
      grid: { weight: 1, strength: 0.4 },
    },
  },
  {
    id: 'sepia',
    style: {
      direction: 'engraved',
      colors: { ink: '#3f2614', rock: '#3f2614', water: '#9c8c68', floor: '#ecd9b4', paper: '#d8bd8f' },
      strokes: { thin: 0.5, normal: 1.5, thick: 2.2 },
      shadow: { color: '#3f2614', strength: 0.8 },
      surround: { reach: 1.5 },
      floor: 'flagstone',
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'moss',
    style: {
      direction: 'stone',
      colors: { ink: '#1f2a1b', rock: '#7d8763', water: '#5d8566', floor: '#dfe2c6', paper: '#aab58a' },
      strokes: { thin: 0.5, normal: 1.5, thick: 0.9 },
      shadow: { color: '#1c2618', strength: 0.55 },
      surround: { reach: 1.6 },
      floor: 'cobble',
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'ice',
    style: {
      direction: 'stone',
      colors: { ink: '#1c3a55', rock: '#9fb8c8', water: '#86bcd9', floor: '#f2f8fb', paper: '#d3e5ef' },
      strokes: { thin: 0.4, normal: 1.3, thick: 0.9 },
      shadow: { color: '#1c3a55', strength: 0.45 },
      surround: { reach: 1.5 },
      floor: 'cobble',
      grid: { weight: 1, strength: 0.4 },
    },
  },
  {
    id: 'volcanic',
    style: {
      direction: 'stone',
      colors: { ink: '#efe2cf', rock: '#2e2523', water: '#e0531b', floor: '#4a3d38', paper: '#1d1716' },
      strokes: { thin: 0.5, normal: 1.4, thick: 0.9 },
      shadow: { color: '#000000', strength: 0.6 },
      surround: { reach: 1.5 },
      floor: 'cobble',
      liquid: 'lava',
      grid: { weight: 1, strength: 0.3 },
    },
  },
  {
    id: 'sandstone',
    style: {
      direction: 'stone',
      colors: { ink: '#4f2f17', rock: '#c49a63', water: '#5f9e9a', floor: '#f4e3c1', paper: '#e6c590' },
      strokes: { thin: 0.5, normal: 1.4, thick: 0.9 },
      shadow: { color: '#4f2f17', strength: 0.5 },
      surround: { reach: 1.5 },
      floor: 'flagstone',
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'sewer',
    style: {
      direction: 'stone',
      colors: { ink: '#1b2016', rock: '#646850', water: '#77823f', floor: '#cfcdb0', paper: '#868a6a' },
      strokes: { thin: 0.5, normal: 1.5, thick: 0.9 },
      shadow: { color: '#1b2016', strength: 0.55 },
      surround: { reach: 1.4 },
      floor: 'ashlar',
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'vellum',
    style: {
      direction: 'stone',
      colors: { ink: '#5e1220', rock: '#c9b398', water: '#a9b5b6', floor: '#fbf4e6', paper: '#f0e3cb' },
      strokes: { thin: 0.5, normal: 1.4, thick: 0.9 },
      shadow: { color: '#3a1018', strength: 0.5 },
      surround: { reach: 1.4 },
      floor: 'flagstone',
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'slate',
    style: {
      direction: 'stone',
      colors: { ink: '#14181c', rock: '#8c8f8f', water: '#5f8a8c', floor: '#a4a9ab', paper: '#cfccc0' },
      strokes: { thin: 0.5, normal: 1.4, thick: 0.9 },
      shadow: { color: '#14181c', strength: 0.5 },
      surround: { reach: 1.4 },
      floor: 'slab',
      grid: { weight: 1, strength: 0.45 },
    },
  },
  {
    id: 'contrast',
    style: {
      direction: 'engraved',
      colors: { ink: '#000000', rock: '#000000', water: '#a9bccb', floor: '#ffffff', paper: '#000000' },
      strokes: { thin: 0.5, normal: 1.6, thick: 2.1 },
      shadow: { color: '#000000', strength: 0.8 },
      surround: { reach: 1.6 },
      floor: 'slab',
      grid: { weight: 1, strength: 0.6 },
    },
  },
  {
    id: 'drafting',
    style: {
      direction: 'engraved',
      colors: { ink: '#1b2733', rock: '#1b2733', water: '#d3e3e8', floor: '#fbfaf6', paper: '#eceee8' },
      strokes: { thin: 0.45, normal: 1.1, thick: 1.8 },
      shadow: { color: '#1b2733', strength: 0.6 },
      surround: { reach: 1.6 },
      floor: 'ashlar',
      grid: { weight: 0.8, strength: 0.4 },
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
