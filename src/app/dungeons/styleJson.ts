import { isFiniteNumber, isRecord } from '../utils/guards';
import {
  DEFAULT_STYLE_PRESET,
  DEFAULT_VIEW,
  STYLE_LIMITS,
  STYLE_PRESETS,
  type DungeonStyle,
  type DungeonView,
  type GridStyle,
  type HatchingMode,
} from './style';

/**
 * Reading styles and views that come from outside the code: Atlas' settings and palette files the
 * GM loads. Every field is checked on its own; one that is missing or wrong takes the base's value,
 * numbers are held within `STYLE_LIMITS`, so a file can never ask the renderer for more than the
 * style dialog could.
 */

type Limit = readonly [number, number];

const HATCHING_MODES: readonly HatchingMode[] = ['hatching', 'stonework', 'bricks', 'dots', 'none'];
export const GRID_STYLES: readonly GridStyle[] = ['off', 'dotted', 'dashed', 'solid', 'broken'];
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

function clampTo([min, max]: Limit, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function colour(value: unknown, base: string): string {
  return typeof value === 'string' && HEX_COLOUR.test(value) ? value.toLowerCase() : base;
}

function number(value: unknown, base: number, limit: Limit, whole = false): number {
  if (!isFiniteNumber(value)) return base;
  return clampTo(limit, whole ? Math.round(value) : value);
}

function oneOf<T extends string>(value: unknown, options: readonly T[], base: T): T {
  return options.includes(value as T) ? (value as T) : base;
}

function flag(value: unknown, base: boolean): boolean {
  return typeof value === 'boolean' ? value : base;
}

function field(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return isRecord(value) ? value : {};
}

/** A style from stored or loaded data, over `base` field by field. */
export function readDungeonStyle(value: unknown, base: DungeonStyle = STYLE_PRESETS[DEFAULT_STYLE_PRESET]): DungeonStyle {
  const record = isRecord(value) ? value : {};
  const colors = field(record, 'colors');
  const strokes = field(record, 'strokes');
  const shadow = field(record, 'shadow');
  const hatching = field(record, 'hatching');
  return {
    colors: {
      ink: colour(colors.ink, base.colors.ink),
      shading: colour(colors.shading, base.colors.shading),
      water: colour(colors.water, base.colors.water),
      floor: colour(colors.floor, base.colors.floor),
      paper: colour(colors.paper, base.colors.paper),
    },
    strokes: {
      thin: number(strokes.thin, base.strokes.thin, STYLE_LIMITS.strokeThin),
      hatching: number(strokes.hatching, base.strokes.hatching, STYLE_LIMITS.strokeHatching),
      normal: number(strokes.normal, base.strokes.normal, STYLE_LIMITS.strokeNormal),
      thick: number(strokes.thick, base.strokes.thick, STYLE_LIMITS.strokeThick),
    },
    shadow: {
      color: colour(shadow.color, base.shadow.color),
      distance: number(shadow.distance, base.shadow.distance, STYLE_LIMITS.shadowDistance),
    },
    hatching: {
      mode: oneOf(hatching.mode, HATCHING_MODES, base.hatching.mode),
      strokes: number(hatching.strokes, base.hatching.strokes, STYLE_LIMITS.hatchingStrokes, true),
      size: number(hatching.size, base.hatching.size, STYLE_LIMITS.hatchingSize),
      distance: number(hatching.distance, base.hatching.distance, STYLE_LIMITS.hatchingDistance),
    },
  };
}

/** A view from stored data, over the defaults field by field. */
export function readDungeonView(value: unknown, base: DungeonView = DEFAULT_VIEW): DungeonView {
  const record = isRecord(value) ? value : {};
  return {
    grid: oneOf(record.grid, GRID_STYLES, base.grid),
    smallTiles: flag(record.smallTiles, base.smallTiles),
    water: flag(record.water, base.water),
    props: flag(record.props, base.props),
    shadow: flag(record.shadow, base.shadow),
    exits: flag(record.exits, base.exits),
    secrets: flag(record.secrets, base.secrets),
    monochrome: flag(record.monochrome, base.monochrome),
  };
}

/** What a palette file holds: the style alone, marked so a file of something else is told apart. */
const PALETTE_FORMAT = 'atlas-dungeon-palette';

export function paletteFileText(style: DungeonStyle): string {
  return `${JSON.stringify({ format: PALETTE_FORMAT, version: 1, style }, null, 2)}\n`;
}

/** The style a palette file holds, or null when the text is no palette. */
export function readPaletteFile(text: string): DungeonStyle | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.format !== PALETTE_FORMAT || !isRecord(parsed.style)) return null;
  return readDungeonStyle(parsed.style);
}
