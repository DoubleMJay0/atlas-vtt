import { traceShapes } from '../geometry';
import { narrowPockets } from '../pockets';
import { parseHex, withAlpha } from '../palette';
import { stream } from '../../rng';
import { layerOf, type ArtScene } from '../art/artScene';
import { rockCoverage } from '../art/rockEdge';
import { blurField, drawField, drawGridCanvas, fieldOf, rgbaCanvas } from '../art/raster';
import { paintLayer } from '../art/strips';
import { cellPattern } from './patterns';
import type { StoneColours } from './colours';
import { ROCK_TILE, rockTile } from './textures';

/**
 * Natural rock round the walls: broken plates lit from the top left, deepest in the angle against
 * the wall's course, thinning out into the vellum plate by plate, so its edge follows the cracks
 * and a few loose plates lie beyond it. It parts before every way in.
 */

/** Where the rock tile lies for a dungeon: its offset in cells, from the seed. */
function tileOffset(seed: number): { x: number; y: number } {
  const rng = stream(seed, 'render', 'rock');
  return { x: rng() * ROCK_TILE.cells, y: rng() * ROCK_TILE.cells };
}

export function drawRock(scene: ArtScene, c: StoneColours): void {
  if (!scene.raster) return drawRockPlain(scene, c);
  const { env, grid } = scene;
  const cover = rockCoverage(scene);
  // The rock is a mass standing over the vellum: it shades it a little, down and right.
  const lift = 0.07;
  const offset = Math.round(lift * grid.res);
  const shade = new Float32Array(cover.length);
  for (let j = 0; j < grid.h; j++) for (let i = 0; i < grid.w; i++) shade[j * grid.w + i] = cover[Math.max(0, j - offset) * grid.w + Math.max(0, i - offset)]!;
  const soft = blurField(grid, shade, grid.res * 0.05, 3).map((v, n) => Math.max(0, v - cover[n]!) * (c.dark ? 0.6 : 0.35));
  // The angle against the wall's course lies deepest.
  const deep = fieldOf(grid, (x, y) => {
    const d = scene.sdfAt(x, y);
    return d < 0 ? 0 : (c.dark ? 0.5 : 0.42) * Math.exp(-d / 0.32) + 0.12 * scene.occlusionAt(x, y);
  });
  const shadowRgb = parseHex(c.dark ? '#000000' : c.line);
  const ctx = env.ctx;
  ctx.save();
  ctx.globalCompositeOperation = c.dark ? 'source-over' : 'multiply';
  drawField(ctx, grid, shadowRgb, soft);
  ctx.restore();
  const off = tileOffset(env.dungeon.model.seed);
  const tile = rockTile();
  const deepCanvas = rgbaCanvas(grid, shadowRgb, deep);
  const mask = rgbaCanvas(grid, [0, 0, 0], cover);
  paintLayer(layerOf(scene), 'source-over', layer => {
    const all = { x: grid.x0, y: grid.y0, w: grid.w / grid.res, h: grid.h / grid.res };
    layer.fillStyle = c.rock;
    layer.fillRect(all.x, all.y, all.w, all.h);
    layer.fillStyle = cellPattern(layer, tile, ROCK_TILE.cells, off.x, off.y);
    layer.fillRect(all.x, all.y, all.w, all.h);
    layer.globalCompositeOperation = 'source-atop';
    drawGridCanvas(layer, grid, deepCanvas);
    layer.globalCompositeOperation = 'destination-in';
    drawGridCanvas(layer, grid, mask);
  });
}

/** Without pictures (the SVG export): the rock as one soft band round the floors, pockets filled. */
function drawRockPlain(scene: ArtScene, c: StoneColours): void {
  const { ctx, dungeon, style } = scene.env;
  const reach = style.surround.reach * 0.6;
  ctx.save();
  ctx.fillStyle = c.rock;
  ctx.beginPath();
  traceShapes(ctx, dungeon.floors, reach, reach);
  for (const { ring } of narrowPockets(dungeon, style.surround.reach / 2)) ring.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.fill();
  ctx.strokeStyle = withAlpha(c.rock, 0.5);
  ctx.lineWidth = 0.08;
  ctx.stroke();
  ctx.restore();
}
