import type { DungeonModel } from '../model';
import type { DungeonStyle, DungeonView } from '../style';
import { drawDungeon } from './drawDungeon';
import type { Canvas2D } from './geometry';
import { mapLayout, type MapLayout } from './layoutSize';
import { legibleStyle } from './legibleStyle';
import { createRenderEnv } from './renderEnv';
import { SvgCanvas } from './svgCanvas';
import { visibleDungeon } from './visibleDungeon';

export interface RenderMapOptions {
  pxPerCell: number;
  /** Leave the paper out, for an image laid over something else. */
  transparent?: boolean;
  /**
   * Keeps hatching and strokes readable where cells are small (`legibleStyle`), for a picture
   * this many times the 1400 × 1000 the legible size is given for: the preview's.
   */
  legibleAt?: number;
}

/**
 * The floor plan, which is all a dungeon is drawn as: nothing written on it. The canvas must be
 * the layout's size (`mapLayout`); pixel (0, 0) is the corner of the returned origin cell.
 */
export function renderMap(ctx: Canvas2D, model: DungeonModel, style: DungeonStyle, view: DungeonView, options: RenderMapOptions): MapLayout {
  const { pxPerCell } = options;
  const layout = mapLayout(model, pxPerCell, view);
  const drawn = options.legibleAt ? legibleStyle(style, pxPerCell / options.legibleAt) : style;
  const env = createRenderEnv(ctx, visibleDungeon(model, view), drawn, view, pxPerCell);
  ctx.save();
  if (!options.transparent) {
    ctx.fillStyle = env.palette.paper;
    ctx.fillRect(0, 0, layout.widthPx, layout.heightPx);
  }
  ctx.scale(pxPerCell, pxPerCell);
  ctx.translate(-layout.originCell.x, -layout.originCell.y);
  drawDungeon(env);
  ctx.restore();
  return layout;
}

/** The floor plan as an SVG document, drawn by the same code into a context that writes SVG. */
export function renderMapSvg(model: DungeonModel, style: DungeonStyle, view: DungeonView, options: RenderMapOptions): { svg: string; layout: MapLayout } {
  const size = mapLayout(model, options.pxPerCell, view);
  const svg = new SvgCanvas(size.widthPx, size.heightPx);
  // The recorder offers every part of the 2D context the renderer uses.
  const layout = renderMap(svg as unknown as Canvas2D, model, style, view, options);
  return { svg: svg.toSvg(), layout };
}

/** The pixels per cell that fit the whole map into `width` × `height` pixels. */
export function fittedPxPerCell(model: DungeonModel, view: DungeonView, width: number, height: number): number {
  const { cellsWide, cellsHigh } = mapLayout(model, 1, view);
  return Math.max(1e-3, Math.min(width / cellsWide, height / cellsHigh));
}
