import type { Rng } from '../rng';
import { clipToFloors } from './floors';
import { pointInPolygon, signedArea2, tracePolygon, type Vec } from './geometry';
import { strokeWidth, type RenderEnv } from './renderEnv';

/** Ripples inside every pool, as far in from its shore, in cells. */
const RIPPLES: readonly { inset: number; on: [number, number]; off: [number, number] }[] = [
  { inset: 0.2, on: [0.25, 0.8], off: [0.1, 0.35] },
  { inset: 0.4, on: [0.15, 0.5], off: [0.3, 0.9] },
];

/** Pools filled with water colour, inked at their shore, with two dashed ripples, cut to the floors. */
export function drawWater(env: RenderEnv): void {
  const { ctx, palette, dungeon, style } = env;
  if (!env.view.water || dungeon.model.water.length === 0) return;
  const rng = env.rng('water');
  ctx.save();
  clipToFloors(env);
  ctx.beginPath();
  for (const pool of dungeon.model.water) tracePolygon(ctx, pool.outline);
  ctx.fillStyle = palette.water;
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = strokeWidth(env, style.strokes.normal);
  ctx.stroke();
  ctx.lineWidth = strokeWidth(env, (style.strokes.normal + style.strokes.thin) / 2);
  ctx.beginPath();
  for (const pool of dungeon.model.water) {
    for (const ripple of RIPPLES) {
      for (const run of insetRuns(pool.outline, ripple.inset)) traceDashes(ctx, run, ripple.on, ripple.off, rng);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The outline moved inward by `inset`, cut where the naive offset folds over itself (tight bays,
 * narrow necks), so each returned run lies a full inset inside the shore.
 */
export function insetRuns(outline: readonly Vec[], inset: number): Vec[][] {
  const n = outline.length;
  if (n < 3) return [];
  const inward = signedArea2(outline) > 0 ? 1 : -1;
  const shifted: (Vec | null)[] = [];
  for (let i = 0; i < n; i++) {
    const prev = outline[(i - 1 + n) % n]!;
    const next = outline[(i + 1) % n]!;
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    // Clockwise on screen, the inside lies to the right of the direction of travel.
    const p = outline[i]!;
    const q = { x: p.x - (ty / len) * inset * inward, y: p.y + (tx / len) * inset * inward };
    shifted.push(pointInPolygon(outline, q.x, q.y) && distanceToOutline(outline, q) > inset * 0.85 ? q : null);
  }
  const start = shifted.findIndex(p => p === null);
  const runs: Vec[][] = [];
  let run: Vec[] = [];
  for (let k = 0; k <= n; k++) {
    const p = shifted[((start < 0 ? 0 : start) + k) % n] ?? null;
    if (p) run.push(p);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (start < 0 && run.length) runs.push([...run]);
  else if (run.length) runs.push(run);
  return runs.filter(r => r.length > 2);
}

function distanceToOutline(outline: readonly Vec[], p: Vec): number {
  let best = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

/** Dashes of random length along a polyline. */
function traceDashes(ctx: CanvasPath, run: readonly Vec[], on: [number, number], off: [number, number], rng: Rng): void {
  let drawing = rng() < 0.5;
  let left = drawing ? lerp(on, rng()) : lerp(off, rng()) * rng();
  for (let i = 0; i + 1 < run.length; i++) {
    let a = run[i]!;
    const b = run[i + 1]!;
    let segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (drawing) ctx.moveTo(a.x, a.y);
    while (segment > left) {
      const t = left / segment;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      segment -= left;
      if (drawing) ctx.lineTo(a.x, a.y);
      else ctx.moveTo(a.x, a.y);
      drawing = !drawing;
      left = drawing ? lerp(on, rng()) : lerp(off, rng());
    }
    left -= segment;
    if (drawing) ctx.lineTo(b.x, b.y);
  }
}

function lerp([a, b]: [number, number], t: number): number {
  return a + (b - a) * t;
}
