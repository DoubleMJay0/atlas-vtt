import type { Canvas2D } from '../geometry';

/** Rows of the picture a layer is painted in at a time, so no layer needs a map-sized canvas. */
const STRIP = 1024;

let scratch: OffscreenCanvas | null = null;

/** One strip canvas for every layer, grown as needed and kept. */
function scratchOf(width: number, height: number): OffscreenCanvas {
  if (!scratch || scratch.width < width || scratch.height < height) {
    scratch = new OffscreenCanvas(Math.max(width, scratch?.width ?? 0), Math.max(height, scratch?.height ?? 0));
  }
  return scratch;
}

/** The picture a layer is painted over: its size in device pixels. */
export interface LayerTarget {
  ctx: Canvas2D;
  widthPx: number;
  heightPx: number;
}

/**
 * Paints `painter` (drawing in cells, as the map's context does) on a layer of its own and lays the
 * layer onto the map with `composite`, strip by strip. A layer is where masking happens: a texture
 * drawn, then cut by a soft mask (`destination-in`) before it reaches the map.
 */
export function paintLayer(target: LayerTarget, composite: GlobalCompositeOperation, painter: (ctx: Canvas2D) => void, alpha = 1): void {
  const main = target.ctx;
  const m = main.getTransform();
  const { widthPx, heightPx } = target;
  const stripHeight = Math.max(1, Math.min(STRIP, heightPx));
  const canvas = scratchOf(widthPx, stripHeight);
  const ctx = canvas.getContext('2d')!;
  for (let y0 = 0; y0 < heightPx; y0 += stripHeight) {
    const rows = Math.min(stripHeight, heightPx - y0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, widthPx, rows);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, widthPx, rows);
    ctx.clip();
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f - y0);
    painter(ctx);
    ctx.restore();
    main.save();
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalCompositeOperation = composite;
    main.globalAlpha = alpha;
    main.drawImage(canvas, 0, 0, widthPx, rows, 0, y0, widthPx, rows);
    main.restore();
  }
}
