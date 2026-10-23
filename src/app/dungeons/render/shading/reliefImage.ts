import type { DungeonModel } from '../../model';
import type { DungeonStyle, DungeonView } from '../../style';
import { rasterRelief } from '../art/heights';
import { gridOver } from '../art/raster';
import { standsOf } from '../art/stands';
import { mapLayout } from '../layoutSize';
import { createRenderEnv } from '../renderEnv';
import { visibleDungeon } from '../visibleDungeon';

/**
 * Pixels per cell of a floor's relief image: the detail of the soft fields the map's own shadows
 * are worked out on (`fieldResolution`), and fine enough that a loose stone is a few pixels across.
 */
export const RELIEF_PX_PER_CELL = 32;

/** A picture's pixels, unpremultiplied RGBA, as a canvas would hand them out. */
export interface RasterImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * How high everything on a floor stands, as a greyscale image over the map's whole layout (black
 * the floor, white a wall's height): the rock round the rooms and the walls, columns, props and
 * terrain that stands and raised floors. What lies on the ground (loose stones, plants) is left out:
 * a lamp casting their shadows was too much (Fabian, 2026-10-23); their small baked shadows stay on
 * the shade. The scene's lighting casts each light's shadows from it. Null outside a browser (no canvas to draw the relief on).
 */
export function renderRelief(model: DungeonModel, style: DungeonStyle, view: DungeonView, floor = 0): RasterImage | null {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const layout = mapLayout(model, RELIEF_PX_PER_CELL, view);
  const ctx = new OffscreenCanvas(1, 1).getContext('2d');
  if (!ctx) return null;
  const env = createRenderEnv(ctx, visibleDungeon(model, view, floor), style, view, RELIEF_PX_PER_CELL);
  const { originCell, cellsWide, cellsHigh } = layout;
  const grid = gridOver(originCell.x, originCell.y, originCell.x + cellsWide, originCell.y + cellsHigh, RELIEF_PX_PER_CELL);
  const relief = rasterRelief(grid, env.dungeon.floors, [], standsOf(env), (x, y) => env.dungeon.field.distance(x, y) > 0);
  const data = new Uint8ClampedArray(grid.w * grid.h * 4);
  relief.heights.forEach((height, k) => {
    const v = Math.round(height * 255);
    data[k * 4] = v;
    data[k * 4 + 1] = v;
    data[k * 4 + 2] = v;
    data[k * 4 + 3] = 255;
  });
  return { width: grid.w, height: grid.h, data };
}
