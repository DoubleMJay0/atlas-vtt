import type { Hand } from '../../art/hand';
import { SHADOW_DIR, TO_LIGHT } from '../../art/light';
import { polyPath, type PathFn } from '../../art/paths';
import { stoneOf } from './wayColours';
import { rngFrom } from '../../../rng';
import { cellPattern } from '../../stone/patterns';
import type { WayFrame } from './narrows';
import { slopeBand } from './slopeShading';

/**
 * The grit of a scree slope as a tile of loose chips, laid with one fill: hundreds of chips drawn
 * one by one cost more than every other part of a way together. Two sizes: fine grit over the whole
 * slope, coarser gravel over its lower part, so the stones grow towards the toe. Stone gives each
 * chip a lit side and a contact shadow; Engraved outlines it. An SVG has no patterns and keeps the
 * slope's stones alone.
 */

/** Cells a tile repeats over, and its texels. */
const TILE_CELLS = 2;
const TILE_PX = 512;
const SIZES = { fine: { count: 300, r: [0.008, 0.02] }, coarse: { count: 90, r: [0.022, 0.042] } } as const;
type Size = keyof typeof SIZES;

const tiles = new Map<string, OffscreenCanvas>();

function tileOf(size: Size, fill: string, ink: string, stone: boolean, light: string): OffscreenCanvas {
  const key = `${size}|${fill}|${ink}|${stone}|${light}`;
  const known = tiles.get(key);
  if (known) return known;
  const canvas = new OffscreenCanvas(TILE_PX, TILE_PX);
  const ctx = canvas.getContext('2d')!;
  const k = TILE_PX / TILE_CELLS;
  ctx.scale(k, k);
  const rng = rngFrom(size === 'fine' ? 0x5c4ee : 0x6a7e1);
  const { count, r: [r0, r1] } = SIZES[size];
  const chips: { x: number; y: number; points: [number, number][] }[] = [];
  for (let i = 0; i < count; i++) {
    const r = r0 + (r1 - r0) * rng() ** 1.5;
    const turn = rng() * Math.PI * 2;
    const corners = 5 + Math.floor(rng() * 2);
    const points: [number, number][] = [];
    for (let j = 0; j < corners; j++) {
      const a = turn + (j + (rng() - 0.5) * 0.5) / corners * Math.PI * 2;
      const rr = r * (0.72 + rng() * 0.4);
      points.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.8]);
    }
    chips.push({ x: rng() * TILE_CELLS, y: rng() * TILE_CELLS, points });
  }
  // Each chip drawn at its place and wrapped across the tile's edges, so the pattern has no seams.
  const each = (draw: (x: number, y: number, points: [number, number][]) => void): void => {
    for (const { x, y, points } of chips) for (const dx of [-TILE_CELLS, 0, TILE_CELLS]) for (const dy of [-TILE_CELLS, 0, TILE_CELLS]) draw(x + dx, y + dy, points);
  };
  const trace = (x: number, y: number, points: [number, number][], ox = 0, oy = 0): void => {
    ctx.moveTo(x + points[0]![0] + ox, y + points[0]![1] + oy);
    for (const [px, py] of points.slice(1)) ctx.lineTo(x + px + ox, y + py + oy);
    ctx.closePath();
  };
  if (stone) {
    ctx.beginPath();
    each((x, y, p) => trace(x, y, p, SHADOW_DIR.x * r1 * 0.5, SHADOW_DIR.y * r1 * 0.5));
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fill();
  }
  ctx.beginPath();
  each((x, y, p) => trace(x, y, p));
  ctx.fillStyle = fill;
  ctx.fill();
  if (stone) {
    ctx.beginPath();
    each((x, y, p) => trace(x, y, p.map(([px, py]) => [px * 0.55, py * 0.55]), TO_LIGHT.x * r0 * 0.6, TO_LIGHT.y * r0 * 0.6));
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = light;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  each((x, y, p) => trace(x, y, p));
  ctx.strokeStyle = ink;
  ctx.lineWidth = stone ? 0.004 : 0.006;
  ctx.stroke();
  tiles.set(key, canvas);
  return canvas;
}

/** Patterns made of each tile, per context: making one copies the tile, so a map makes each once. */
const patterns = new WeakMap<object, Map<OffscreenCanvas, CanvasPattern>>();

/** The grit tile of `size` in the look's rock, as a pattern laid from `origin`. */
function gritPattern(hand: Hand, size: Size, origin: { x: number; y: number }): CanvasPattern {
  const { ctx } = hand.scene.env;
  const { fill, ink } = hand.paint('rock');
  const c = stoneOf(hand);
  const tile = tileOf(size, fill, ink, c !== null, c ? c.light : ink);
  let made = patterns.get(ctx);
  if (!made) patterns.set(ctx, (made = new Map<OffscreenCanvas, CanvasPattern>()));
  let pattern = made.get(tile);
  if (!pattern) made.set(tile, (pattern = cellPattern(ctx, tile, TILE_CELLS)));
  const k = TILE_CELLS / tile.width;
  pattern.setTransform(new DOMMatrix([k, 0, 0, k, origin.x, origin.y]));
  return pattern;
}

/** Lays grit inside `path`: fine over the slope below `fineFrom`, coarse below `coarseFrom` (shares of the way down). */
export function layGrit(hand: Hand, frame: WayFrame, path: PathFn, fineFrom: number, coarseFrom: number): void {
  if (!hand.scene.raster) return;
  const { ctx } = hand.scene.env;
  const origin = { x: frame.bounds.minX, y: frame.bounds.minY };
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.clip();
  for (const [size, from] of [['fine', fineFrom], ['coarse', coarseFrom]] as const) {
    ctx.beginPath();
    polyPath(slopeBand(frame, from, 1.2))(ctx);
    ctx.fillStyle = gritPattern(hand, size, origin);
    ctx.fill();
  }
  ctx.restore();
}

/** Lays fine grit over the whole of `path`: what fell down a shaft, lying in its light. */
export function layGritIn(hand: Hand, path: PathFn, origin: { x: number; y: number }): void {
  if (!hand.scene.raster) return;
  const { ctx } = hand.scene.env;
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = gritPattern(hand, 'fine', origin);
  ctx.fill();
  ctx.restore();
}
