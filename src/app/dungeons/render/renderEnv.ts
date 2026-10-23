import { floorStream, type Rng } from '../rng';
import type { DungeonStyle, DungeonView } from '../style';
import { REFERENCE_CELL_PX } from '../style';
import type { Canvas2D } from './geometry';
import { paletteOf, type Palette } from './palette';
import type { VisibleDungeon } from './visibleDungeon';

/**
 * Everything a layer needs. Layers draw in cells: the caller has scaled the context so one unit
 * is one cell, and a reference pixel (style numbers are given at 30 px per cell) is `px` units.
 */
export interface RenderEnv {
  ctx: Canvas2D;
  dungeon: VisibleDungeon;
  style: DungeonStyle;
  view: DungeonView;
  palette: Palette;
  /** One reference pixel, in cells. */
  px: number;
  /** Device pixels per cell, for choosing detail. */
  pxPerCell: number;
  /** A seeded stream of the render concern, split by layer. */
  rng(key: string): Rng;
}

export function createRenderEnv(
  ctx: Canvas2D,
  dungeon: VisibleDungeon,
  style: DungeonStyle,
  view: DungeonView,
  pxPerCell: number,
): RenderEnv {
  return {
    ctx,
    dungeon,
    style,
    view,
    palette: paletteOf(style, view),
    px: 1 / REFERENCE_CELL_PX,
    pxPerCell,
    rng: (key: string): Rng => floorStream(dungeon.model.seed, 'render', dungeon.index, key),
  };
}

/** A stroke width given in reference pixels, in cells. */
export function strokeWidth(env: RenderEnv, referencePx: number): number {
  return referencePx * env.px;
}
