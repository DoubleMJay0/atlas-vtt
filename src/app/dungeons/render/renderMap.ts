import type { DungeonModel } from '../model';
import type { DungeonStyle, DungeonView } from '../style';
import { REFERENCE_CELL_PX } from '../style';
import { drawDungeon } from './drawDungeon';
import { cssFont } from './fonts';
import type { Canvas2D } from './geometry';
import { mapLayout, type MapLayout } from './layoutSize';
import { createRenderEnv } from './renderEnv';
import { drawLabels, haloAt, roomLabels } from './roomLabels';
import { visibleDungeon } from './visibleDungeon';

export interface RenderMapOptions {
  pxPerCell: number;
  /** Room numbers of the noted rooms. */
  numbers: boolean;
  /** Leave the paper out, for an image laid over something else. */
  transparent?: boolean;
}

/**
 * The floor plan alone, for a scene: no title, story or notes. The canvas must be the layout's
 * size (`mapLayout`); pixel (0, 0) is the corner of the returned origin cell.
 */
export function renderMap(ctx: Canvas2D, model: DungeonModel, style: DungeonStyle, view: DungeonView, options: RenderMapOptions): MapLayout {
  const { pxPerCell } = options;
  const layout = mapLayout(model, pxPerCell, view);
  const dungeon = visibleDungeon(model, view);
  const env = createRenderEnv(ctx, dungeon, style, view, pxPerCell);
  ctx.save();
  if (!options.transparent) {
    ctx.fillStyle = env.palette.paper;
    ctx.fillRect(0, 0, layout.widthPx, layout.heightPx);
  }
  ctx.scale(pxPerCell, pxPerCell);
  ctx.translate(-layout.originCell.x, -layout.originCell.y);
  drawDungeon(env);
  ctx.restore();
  if (options.numbers) {
    const k = pxPerCell / REFERENCE_CELL_PX;
    const labels = roomLabels(dungeon, 'symbols').map(label => ({
      text: label.text,
      x: (label.at.x - layout.originCell.x) * pxPerCell,
      y: (label.at.y - layout.originCell.y) * pxPerCell,
      halo: haloAt(dungeon, env.palette, view.water, label.at),
    }));
    drawLabels(ctx, labels, cssFont(style.fonts.symbols, style.fonts.symbols.size * k), env.palette.ink, style.strokes.normal * 4 * k);
  }
  return layout;
}
