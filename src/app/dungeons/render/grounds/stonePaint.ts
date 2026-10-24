/**
 * Stone & shadow's grounds: lawn as broad patches of lighter and deeper green under a scatter of
 * blades, gravel as a pale bed of grit with lit and shaded pebbles, and leaves as clumps over
 * clumps, each shaded on the side away from the light and lit on the side towards it. The greens
 * are the look's plant ramps (`plantColours`), so they sink on a dark look and turn to tones in
 * monochrome.
 */

import { TO_LIGHT, SHADOW_DIR } from '../art/light';
import type { Hand } from '../art/hand';
import { noiseSampler } from '../art/noise';
import { polysPath, type PathFn } from '../art/paths';
import { drawGridCanvas, fieldOf, gridOver, rgbaCanvas } from '../art/raster';
import { boundedCached } from '../boundedCache';
import { pointsBounds, type Bounds, type Vec } from '../geometry';
import { hex, mixColours, parseHex, withAlpha, type Rgb } from '../palette';
import type { StoneColours } from '../stone/colours';
import { lightInside } from '../stone/lightInside';
import { cellPattern } from '../stone/patterns';
import { css, plantColours, rampAt, type Ramp } from '../stone/plantColours';
import { grainTile, tileTexels } from '../stone/textures';
import { scatter, type GroundsPaint } from './paint';

const lerp = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as Rgb;

export function stoneGroundsPaint(hand: Hand, c: StoneColours): GroundsPaint {
  const { scene } = hand;
  const { ctx } = scene.env;
  const seed = scene.env.dungeon.model.seed;
  const plants = plantColours(c, seed);
  const grass = plants.leaves.grass;
  const floor = parseHex(c.floor);
  // A lawn a little paler than the grass itself, drawn towards the paper as the look's plants are.
  const lawn = hex(lerp(grass[1], floor, c.dark ? 0.45 : 0.42));
  const gravel = c.mono ? mixColours(c.floor, c.line, 0.1) : c.dark ? mixColours(c.floor, c.line, 0.12) : mixColours(c.floor, c.rock, 0.5);
  const clipped = (path: PathFn, draw: () => void): void => {
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.clip();
    draw();
    ctx.restore();
  };
  const dots = (points: readonly { x: number; y: number; r: number }[], colour: string): void => {
    ctx.beginPath();
    for (const p of points) {
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = colour;
    ctx.fill();
  };
  return {
    lawn: (path, bounds) =>
      clipped(path, () => {
        ctx.fillStyle = lawn;
        ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
        if (scene.raster) mottle(ctx, bounds, grass, seed);
        blades(ctx, bounds, grass, seed);
      }),
    gravel: (path, bounds) =>
      clipped(path, () => {
        ctx.fillStyle = gravel;
        ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
        if (scene.raster) {
          ctx.fillStyle = cellPattern(ctx, grainTile(0.12, tileTexels(1.2)), 1.2);
          ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
        }
        const pebbles = scatter(bounds, 36, seed + 7).map((p) => ({ x: p.x, y: p.y, r: 0.009 + 0.013 * p.t }));
        dots(pebbles.map((p) => ({ ...p, x: p.x + SHADOW_DIR.x * 0.006, y: p.y + SHADOW_DIR.y * 0.006 })), mixColours(gravel, c.dark ? '#000000' : c.line, 0.38));
        dots(pebbles.map((p) => ({ ...p, r: p.r * 0.7, x: p.x + TO_LIGHT.x * 0.004, y: p.y + TO_LIGHT.y * 0.004 })), mixColours(gravel, c.light, c.dark ? 0.12 : 0.45));
      }),
    foliage: (rings, clump, salt, dome) => {
      const path = polysPath(rings);
      const ramp = dome ? plants.leaves.green : plants.leaves.bramble;
      const bounds = pointsBounds(rings.flat());
      clipped(path, () => {
        // The deep between clumps is the base; each clump stands out of it, lit towards the light.
        ctx.fillStyle = rampAt(ramp, 0.06);
        ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
        const clumps = scatter(bounds, 1 / (clump * 1.2) ** 2, seed + salt);
        const at = (d: Vec, k: number, r: number) => clumps.map((p) => ({ x: p.x + d.x * clump * k, y: p.y + d.y * clump * k, r: clump * r * (0.85 + 0.3 * p.t) }));
        dots(at(TO_LIGHT, 0.12, 0.86), rampAt(ramp, 0.45));
        dots(at(TO_LIGHT, 0.32, 0.48), rampAt(ramp, 0.86, c.dark ? 0.5 : 0.85));
        if (dome && scene.raster) lightInside(ctx, c, dome.centre, dome.radius, 0.9);
      });
      if (!dome) return;
      ctx.save();
      ctx.beginPath();
      path(ctx);
      ctx.strokeStyle = css(plants.edge, c.dark ? 0.6 : 0.75);
      ctx.lineWidth = hand.weight('fine') * 1.4;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    },
    pool: (path, centre, radius) =>
      clipped(path, () => {
        ctx.fillStyle = c.water;
        ctx.fill();
        if (scene.raster) {
          // Deeper, and darker, towards the middle.
          const deep = ctx.createRadialGradient(centre.x, centre.y, 0, centre.x, centre.y, radius);
          deep.addColorStop(0, withAlpha(c.dark ? '#000000' : c.line, c.dark ? 0.35 : 0.22));
          deep.addColorStop(1, withAlpha(c.dark ? '#000000' : c.line, 0));
          ctx.fillStyle = deep;
          ctx.fill();
        }
        ctx.beginPath();
        for (const r of [0.45, 0.68].map((k) => radius * k)) {
          ctx.moveTo(centre.x + r * Math.cos(0.4), centre.y + r * Math.sin(0.4));
          ctx.arc(centre.x, centre.y, r, 0.4, 0.4 + Math.PI * 1.3);
        }
        ctx.strokeStyle = withAlpha(c.light, c.dark ? 0.25 : 0.6);
        ctx.lineWidth = hand.weight('fine');
        ctx.stroke();
      }),
  };
}

/** The mottling repeats every this many cells, seamlessly. */
const MOTTLE_CELLS = 6;
const mottles = new Map<string, OffscreenCanvas>();

/** Broad patches of lighter and deeper grass, soft-edged, a few cells across: one seamless tile per look and seed, laid as a pattern. */
function mottle(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, bounds: Bounds, grass: Ramp, seed: number): void {
  const tile = boundedCached(mottles, `${grass.flat().join(',')}:${seed}`, 8, () => {
    const grid = gridOver(0, 0, MOTTLE_CELLS, MOTTLE_CELLS, 16);
    const noise = noiseSampler(seed + 61, MOTTLE_CELLS, 3, 3);
    const values = fieldOf(grid, (x, y) => noise(x, y));
    const canvas = new OffscreenCanvas(grid.w, grid.h);
    const tileCtx = canvas.getContext('2d')!;
    tileCtx.setTransform(grid.res, 0, 0, grid.res, 0, 0);
    drawGridCanvas(tileCtx, grid, rgbaCanvas(grid, grass[0], values.map((v) => Math.max(0, v - 0.55) * 0.55)));
    drawGridCanvas(tileCtx, grid, rgbaCanvas(grid, grass[2], values.map((v) => Math.max(0, 0.42 - v) * 0.45)));
    return canvas;
  });
  ctx.fillStyle = cellPattern(ctx, tile, MOTTLE_CELLS);
  ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
}

/** Blades of grass seen from above: short strokes every way, deeper ones and lit ones. */
function blades(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, bounds: Bounds, grass: Ramp, seed: number): void {
  // A close, low nap: many short blades, the deeper ones a little more than the lit.
  const all = scatter(bounds, 30, seed + 3);
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.008;
  for (const [lit, colour] of [[false, rampAt(grass, 0.18, 0.4)], [true, rampAt(grass, 0.92, 0.45)]] as const) {
    ctx.beginPath();
    for (const p of all) {
      if (p.t < 0.58 === lit) continue;
      const angle = p.t * 37.7;
      const len = 0.03 + 0.03 * ((p.t * 7.3) % 1);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(angle) * len, p.y + Math.sin(angle) * len);
    }
    ctx.strokeStyle = colour;
    ctx.stroke();
  }
}
