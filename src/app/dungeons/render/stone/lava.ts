import type { Vec } from '../geometry';
import { withAlpha } from '../palette';
import type { ArtScene } from '../art/artScene';
import { GLOW, moltenAt, type Molten } from '../art/lavaField';
import { clipFloors } from '../art/outline';
import type { PathFn } from '../art/paths';
import { depthField } from '../art/pools';
import { cellOf, drawField, drawGridCanvas, fieldOf, gridOver, pixelCanvas } from '../art/raster';
import { pointsBounds } from '../geometry';
import type { StoneColours } from './colours';

/** Molten rock within `trace`: its crust and seams, its glow spilling onto the floor round it, its shore inked. */
export function drawLava(scene: ArtScene, c: StoneColours, outlines: readonly Vec[][], trace: PathFn, kind: Molten = 'lava'): void {
  const { ctx } = scene.env;
  const points = outlines.flat();
  if (!points.length) return;
  const depth = depthField(scene, trace, points);
  if (scene.raster) {
    const b = pointsBounds(points);
    const res = Math.min(60, Math.max(8, scene.frame.pxPerCell / 3));
    const grid = gridOver(b.minX - 0.9, b.minY - 0.9, b.maxX + 0.9, b.maxY + 0.9, res);
    const molten = pixelCanvas(grid, (k, out, o) => {
      const p = cellOf(grid, k % grid.w, Math.floor(k / grid.w));
      moltenAt(kind, p.x, p.y, depth(p.x, p.y), out, o);
    });
    // The glow on the floor: farther than the shore's own reach, fading.
    const glow = fieldOf(grid, (x, y) => {
      const d = depth(x, y);
      if (d > 0) return 0;
      let near = 0;
      for (const [dx, dy] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]] as const) if (depth(x + dx, y + dy) > 0) near = Math.max(near, 1 - Math.hypot(dx, dy) * 1.4);
      return near * (c.dark ? 0.45 : 0.28);
    });
    ctx.save();
    clipFloors(scene);
    ctx.globalCompositeOperation = c.dark ? 'screen' : 'multiply';
    drawField(ctx, grid, GLOW[kind], glow);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    trace(ctx);
    ctx.clip();
    drawGridCanvas(ctx, grid, molten);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    trace(ctx);
    ctx.fillStyle = kind === 'lava' ? '#c8582e' : '#93a84a';
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  trace(ctx);
  ctx.strokeStyle = withAlpha(c.dark ? '#000000' : c.line, 0.8);
  ctx.lineWidth = 0.016;
  ctx.stroke();
  ctx.restore();
}
