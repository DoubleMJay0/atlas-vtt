import { pointsBounds, type Vec } from '../geometry';
import { mixColours, parseHex, withAlpha } from '../palette';
import { insetRuns } from '../shore';
import { layerOf, type ArtScene } from '../art/artScene';
import { noiseSampler } from '../art/noise';
import { clipFloors } from '../art/outline';
import { grown, smoothstep, type Field, type PathFn } from '../art/paths';
import { depthField, poolOutlines, poolsPath } from '../art/pools';
import { drawGridCanvas, fieldOf, gridOver, rgbaCanvas } from '../art/raster';
import { paintLayer } from '../art/strips';
import type { StoneColours } from './colours';
import { drawLava } from './lava';

/**
 * Still water: clear at its shore, so the floor shows through, deepening and darkening away from
 * it; a broad soft sheen of the light on its surface, never ripples drawn as lines; a wet margin
 * on the floor round it and a lit lip at its edge.
 */
export function drawPools(scene: ArtScene, c: StoneColours): void {
  const outlines = poolOutlines(scene);
  if (!outlines.length) return;
  const trace = poolsPath(outlines);
  if (scene.env.style.liquid === 'lava' && !c.mono) return drawLava(scene, c, outlines.map(o => o), trace);
  paintWater(scene, c, trace, outlines, depthField(scene, trace, outlines.flat()), false);
}

/** Water within `trace` (shores `outlines`), its depth by `depth`; deep water falls away steeply. */
export function paintWater(scene: ArtScene, c: StoneColours, trace: PathFn, outlines: readonly Vec[][], depth: Field, deep: boolean): void {
  const { ctx, dungeon } = scene.env;
  const seed = dungeon.model.seed;
  // The wet margin on the floor round the water.
  ctx.save();
  clipFloors(scene);
  ctx.beginPath();
  trace(ctx);
  ctx.strokeStyle = withAlpha(c.dark ? '#000000' : c.line, 0.1);
  ctx.lineWidth = 0.14;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
  const shallow = c.water;
  const deepColour = c.mono ? c.line : mixColours(c.water, c.dark ? '#000000' : c.line, deep ? 0.6 : 0.42);
  if (scene.raster) {
    const area = grown(pointsBounds(outlines.flat()), 0.1);
    const grid = gridOver(area.minX, area.minY, area.maxX, area.maxY, scene.grid.res);
    const body = fieldOf(grid, (x, y) => {
      const d = depth(x, y);
      if (d <= 0) return 0;
      const k = deep ? 0.6 * smoothstep(0, 0.12, d) + 0.4 * smoothstep(0.12, 1.1, d) : smoothstep(0, 1.1, d) ** 0.9;
      return k * (c.mono ? 0.3 : deep ? 0.95 : 0.75);
    });
    const sheen = noiseSampler(seed + 41, 7, 2, 3);
    const glint = fieldOf(grid, (x, y) => (depth(x, y) > 0.05 ? Math.max(0, sheen(x + y * 0.35, y) - 0.52) * (c.dark ? 0.25 : 0.55) : 0));
    const bodyCanvas = rgbaCanvas(grid, parseHex(deepColour), body);
    const glintCanvas = c.mono ? null : rgbaCanvas(grid, parseHex(c.dark ? c.light : '#ffffff'), glint);
    paintLayer(layerOf(scene), 'source-over', layer => {
      clipFloors(scene, layer);
      layer.beginPath();
      trace(layer);
      layer.clip();
      layer.globalAlpha = c.mono ? 0.35 : deep ? 0.95 : 0.55;
      layer.fillStyle = shallow;
      layer.fillRect(grid.x0, grid.y0, grid.w / grid.res, grid.h / grid.res);
      layer.globalAlpha = 1;
      drawGridCanvas(layer, grid, bodyCanvas);
      if (glintCanvas) drawGridCanvas(layer, grid, glintCanvas);
    }, area);
  } else {
    ctx.save();
    ctx.beginPath();
    trace(ctx);
    ctx.fillStyle = mixColours(shallow, deepColour, 0.3);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  clipFloors(scene);
  ctx.beginPath();
  trace(ctx);
  ctx.strokeStyle = withAlpha(c.dark ? '#000000' : c.line, deep ? 0.75 : 0.5);
  ctx.lineWidth = deep ? 0.018 : 0.011;
  ctx.stroke();
  ctx.beginPath();
  for (const outline of outlines) {
    for (const run of insetRuns(outline, 0.028)) {
      ctx.moveTo(run[0]!.x, run[0]!.y);
      for (const p of run.slice(1)) ctx.lineTo(p.x, p.y);
    }
  }
  ctx.strokeStyle = withAlpha(c.light, c.dark ? 0.14 : 0.45);
  ctx.lineWidth = 0.008;
  ctx.stroke();
  ctx.restore();
}
