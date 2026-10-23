import type { CellDir, CellPoint } from '../model';
import { wallWidth } from './floors';
import { block, glyphWeights, strokeFine, type GlyphPen } from './glyphPen';
import { strokeWidth, type RenderEnv } from './renderEnv';

/**
 * Passages in the glyph family's grammar (`glyphPen.ts`), drawn over walls and floor: an opening's
 * wall ends, a door set into them, steps inside a passage and a stairwell between floors. Each
 * draws in its own frame: u across the way, v along it, in cells. Depth reads as ink: every tread
 * casts a shadow onto the one below it, and the shadows deepen towards the lower end, so the way
 * down shows without a word or an arrow.
 */

/** A door cell: the one-cell passage through a wall, `dir` from the room it leaves to the room it enters. */
export interface PassageCell extends CellPoint {
  dir: CellDir;
}

/** A stairwell's rectangle in cells, its treads descending towards `down`. */
export interface StairwellRect {
  x: number;
  y: number;
  w: number;
  h: number;
  down: CellDir;
}

/** Which floor a stairwell is drawn on: the one it goes down from, or the one it comes up to. */
export type StairwellEnd = 'upper' | 'lower';

/** The clear width between an opening's wall ends, and how deep the ends are along the way, in cells. */
export const OPENING_WIDTH = 0.62;
export const OPENING_DEPTH = 0.3;
/** A door slab's thickness. */
const SLAB = 0.18;
/** The distance between two treads of a stairwell, and of steps inside a passage. */
const TREAD = 0.2;
const STEP = 0.22;
/** The shadow below the highest and the lowest tread, as shares of a tread. */
const SHADOW = { first: 0.04, last: 0.8 };

/** Moves the context into a door cell's frame. */
function cellFrame(env: RenderEnv, cell: PassageCell): void {
  env.ctx.translate(cell.x + 0.5, cell.y + 0.5);
  env.ctx.transform(-cell.dir.y, cell.dir.x, cell.dir.x, cell.dir.y, 0, 0);
}

function penOf(env: RenderEnv): GlyphPen {
  return { ctx: env.ctx, palette: env.palette, fine: glyphWeights(env).fine };
}

/** The two wall ends of an opening, square and solid, reaching into the walls beside them. */
function wallEnds(env: RenderEnv): void {
  const { ctx } = env;
  const from = OPENING_WIDTH / 2;
  const to = 0.5 + wallWidth(env);
  ctx.fillStyle = env.palette.ink;
  ctx.fillRect(from, -OPENING_DEPTH / 2, to - from, OPENING_DEPTH);
  ctx.fillRect(-to, -OPENING_DEPTH / 2, to - from, OPENING_DEPTH);
}

/** An opening: the wall ends either side of the gap, nothing across it. */
export function drawOpening(env: RenderEnv, cell: PassageCell): void {
  env.ctx.save();
  cellFrame(env, cell);
  wallEnds(env);
  env.ctx.restore();
}

/** A door: a slab of the fill colour set into the wall ends, across the gap. */
export function drawDoor(env: RenderEnv, cell: PassageCell): void {
  const { ctx } = env;
  ctx.save();
  cellFrame(env, cell);
  wallEnds(env);
  const pen = penOf(env);
  ctx.strokeStyle = env.palette.ink;
  ctx.lineJoin = 'round';
  ctx.lineWidth = glyphWeights(env).outline;
  // The slab reaches into the wall ends, so it reads as hung in them.
  block(pen, 0, 0, OPENING_WIDTH + 0.12, SLAB, env.palette.fill, 0.02);
  ctx.restore();
}

/**
 * Treads from v = `from` to v = `to` across a way `width` wide, the lower end at `to`. Each tread's
 * nosing is inked; below it lies the shadow it casts, `shadow(k)` of a tread for the k-th of `n`
 * from the top, and `dashedFrom` (a v) on the treads are drawn dashed and without shadow.
 */
function treads(env: RenderEnv, width: number, from: number, to: number, shadow: (k: number, n: number) => number, dashedFrom?: number, tread = TREAD): void {
  const { ctx, palette } = env;
  const sign = Math.sign(to - from);
  const n = Math.max(2, Math.round(Math.abs(to - from) / tread));
  const step = (to - from) / n;
  const half = width / 2;
  const pen = penOf(env);
  const solid: number[] = [];
  const dashed: number[] = [];
  ctx.fillStyle = palette.ink;
  for (let k = 0; k < n; k++) {
    const v = from + step * k;
    const hidden = dashedFrom !== undefined && Math.sign(v - dashedFrom) !== sign;
    (hidden ? dashed : solid).push(v);
    if (hidden) continue;
    const depth = Math.abs(step) * shadow(k, n);
    ctx.fillRect(-half, sign > 0 ? v : v - depth, width, depth);
  }
  ctx.strokeStyle = palette.ink;
  ctx.lineCap = 'butt';
  ctx.lineWidth = glyphWeights(env).outline;
  ctx.beginPath();
  for (const v of solid) {
    ctx.moveTo(-half, v);
    ctx.lineTo(half, v);
  }
  ctx.stroke();
  if (!dashed.length) return;
  ctx.save();
  ctx.setLineDash([pen.fine * 3, pen.fine * 2.5]);
  ctx.beginPath();
  for (const v of dashed) {
    ctx.moveTo(-half, v);
    ctx.lineTo(half, v);
  }
  strokeFine(pen);
  ctx.restore();
}

/** Shadows that deepen from the top tread to the bottom one. */
function deepening(k: number, n: number): number {
  const t = n <= 1 ? 1 : k / (n - 1);
  return SHADOW.first + (SHADOW.last - SHADOW.first) * t ** 1.6;
}

/** Steps inside a passage: treads across the door cell, descending along `dir` when `descends`, else against it. */
export function drawSteps(env: RenderEnv, cell: PassageCell, descends: boolean): void {
  const { ctx } = env;
  ctx.save();
  cellFrame(env, cell);
  const low = descends ? 0.5 : -0.5;
  // Fewer, deeper treads than a stairwell's, so the few shadows still deepen visibly.
  treads(env, 1, -low + Math.sign(low) * 0.12, low, deepening, undefined, STEP);
  ctx.restore();
}

/**
 * A stairwell between two floors, the same treads on both. On the upper floor it goes down: its
 * shadows deepen until the treads sink into darkness at the low end, and a rail edges the drop.
 * On the lower floor it comes up: the treads start light at the low end, and past the ceiling, cut
 * by a break line, they go on dashed.
 */
export function drawStairwell(env: RenderEnv, stair: StairwellRect, end: StairwellEnd): void {
  const { ctx, palette } = env;
  const along = stair.down.x !== 0 ? stair.w : stair.h;
  const across = stair.down.x !== 0 ? stair.h : stair.w;
  ctx.save();
  ctx.translate(stair.x + stair.w / 2, stair.y + stair.h / 2);
  ctx.transform(-stair.down.y, stair.down.x, stair.down.x, stair.down.y, 0, 0);
  const top = -along / 2;
  const bottom = along / 2;
  const half = across / 2;
  const pen = penOf(env);
  ctx.fillStyle = palette.floor;
  ctx.fillRect(-half, top, across, along);
  if (end === 'upper') {
    // The last tread opens into the dark below.
    const dark = TREAD * 1.2;
    treads(env, across, top + TREAD * 0.5, bottom - dark, deepening);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(-half, bottom - dark, across, dark);
  } else {
    const cut = top + along * 0.38;
    treads(env, across, top + TREAD * 0.5, bottom, () => SHADOW.first, cut);
    breakLine(env, across, cut);
  }
  // Rails along the sides, and across the end that is no way on.
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = strokeWidth(env, env.style.strokes.normal);
  ctx.beginPath();
  if (end === 'upper') {
    ctx.moveTo(-half, top);
    ctx.lineTo(-half, bottom);
    ctx.lineTo(half, bottom);
    ctx.lineTo(half, top);
    ctx.stroke();
  } else {
    ctx.moveTo(-half, bottom);
    ctx.lineTo(-half, top + along * 0.38);
    ctx.moveTo(half, bottom);
    ctx.lineTo(half, top + along * 0.38);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([pen.fine * 3, pen.fine * 2.5]);
    ctx.beginPath();
    ctx.moveTo(-half, top + along * 0.38);
    ctx.lineTo(-half, top);
    ctx.lineTo(half, top);
    ctx.lineTo(half, top + along * 0.38);
    strokeFine(pen);
    ctx.restore();
  }
  ctx.restore();
}

/** The drafter's break line where a stair passes through the ceiling: straight, with one kink. */
function breakLine(env: RenderEnv, width: number, v: number): void {
  const { ctx } = env;
  const half = width / 2;
  const kink = Math.min(0.08, width * 0.08);
  ctx.beginPath();
  ctx.moveTo(-half - 0.04, v + kink);
  ctx.lineTo(-kink, v + kink);
  ctx.lineTo(0, v - kink * 1.5);
  ctx.lineTo(kink * 0.5, v + kink * 2);
  ctx.lineTo(kink * 1.5, v - kink);
  ctx.lineTo(half + 0.04, v - kink);
  ctx.strokeStyle = env.palette.ink;
  ctx.lineWidth = strokeWidth(env, env.style.strokes.normal);
  ctx.lineJoin = 'miter';
  ctx.stroke();
}
