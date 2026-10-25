import type { StairEnd } from '../../../floors/stairSpots';
import type { Hand } from '../../art/hand';
import { SHADOW_DIR, TO_LIGHT } from '../../art/light';
import { valueNoise } from '../../art/noise';
import { polyPath, polysPath, type PathFn } from '../../art/paths';
import { pointsBounds, type Vec } from '../../geometry';
import { mixColours, withAlpha } from '../../palette';
import type { WayFrame } from './narrows';
import type { ScreeShape } from './screeShape';
import { stoneOf } from './wayColours';

/**
 * A scree slope's light, following its form: loose rock heaped into a tongue is lit on the flank
 * that faces the light and shaded on the other, which casts a soft shadow on the floor beside it;
 * the whole slope is a little lighter where it faces the light. Its fill fades out at the toe, so
 * the stones run out onto the floor. Where it goes down from this floor (`upper`) its foot sinks
 * into the dark; where it comes up (`lower`) its crest is in the ceiling's shadow. Stone lays all of
 * this as gradients (raster pictures; an SVG keeps a plain tint and the slope's lines); Engraved has
 * no tone box at all, only its hachures, stones and a little hatching where the slope goes dark.
 */

/** Engraved's hatching inside the tongue (from, to, tone), only where the slope goes dark. */
const ENGRAVED_DARK: Record<StairEnd | 'steps', readonly (readonly [number, number, number])[]> = {
  upper: [],
  lower: [[-0.2, 0.22, 0.36]],
  steps: [],
};

/** The way across the slope that faces the light, as +1 or −1 of `u`. */
function litSide(frame: WayFrame): number {
  const a = frame.at(0, 0);
  const b = frame.at(1, 0);
  return (b.x - a.x) * TO_LIGHT.x + (b.y - a.y) * TO_LIGHT.y > 0 ? 1 : -1;
}

function fill(hand: Hand, path: PathFn, style: string | CanvasGradient, clip: PathFn | null = null): void {
  const { ctx } = hand.scene.env;
  ctx.save();
  if (clip) {
    ctx.beginPath();
    clip(ctx);
    ctx.clip();
  }
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = style;
  ctx.fill();
  ctx.restore();
}

export function layScreeForm(hand: Hand, frame: WayFrame, shape: ScreeShape, end?: StairEnd): void {
  const path = polyPath(shape.outline);
  const c = stoneOf(hand);
  if (!c) {
    if (!ENGRAVED_DARK[end ?? 'steps'].length) return;
    const { ctx } = hand.scene.env;
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.clip();
    for (const [t0, t1, level] of ENGRAVED_DARK[end ?? 'steps']) {
      const band = slopeBand(frame, t0, t1);
      hand.tone(() => level, pointsBounds(band), polyPath(band), 'shade');
    }
    ctx.restore();
    return;
  }
  const rock = hand.paint('rock').fill;
  const { ctx } = hand.scene.env;
  if (!hand.scene.raster) {
    fill(hand, path, withAlpha(rock, 0.35));
    return;
  }
  layHeapShadow(hand, shape);
  // One gradient, round a point on the crest's lit side and stretched down the fall line: lighter
  // there, where the heap faces the light, darker across to its shaded flank and on down the slope;
  // sinking into the dark where the slope goes down, shaded under the ceiling where it comes up,
  // fading out over the toe elsewhere, so it ends on the floor without an edge. One fill over the
  // heap's whole area: the ways' cost is the area they fill, not the shapes they draw.
  const side = litSide(frame);
  const facing = frame.down.x * TO_LIGHT.x + frame.down.y * TO_LIGHT.y > 0;
  const lift = mixColours(rock, c.light, (c.dark ? 0.12 : 0.22) + (facing ? 0.06 : 0));
  const dark = (k: number): string => mixColours(rock, '#000000', k);
  const stops: readonly [number, string, number][] = end === 'upper'
    ? [[0, lift, 0.66], [0.45, rock, 0.62], [0.72, dark(0.45), 0.72], [1, '#000000', 0.62]]
    : end === 'lower'
      ? [[0, dark(0.45), 0.72], [0.3, lift, 0.6], [0.62, dark(0.18), 0.45], [0.86, rock, 0.18], [1, rock, 0]]
      : [[0, lift, 0.66], [0.45, rock, 0.56], [0.7, dark(0.2), 0.42], [0.88, rock, 0.14], [1, rock, 0]];
  const from = frame.at(side * shape.width(0) * 0.6, shape.vAt(0.04));
  const length = shape.vAt(1) - shape.vAt(0.04);
  const [rx, ry] = frame.down.x ? [length, shape.width(0.8) * 1.9] : [shape.width(0.8) * 1.9, length];
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.clip();
  ctx.translate(from.x, from.y);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [t, colour, alpha] of stops) g.addColorStop(t, withAlpha(colour, alpha));
  ctx.fillStyle = g;
  ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
  ctx.restore();
}

/**
 * The heap's shadow on the floor beside it, away from the light: a strip along the part of its edge
 * that faces away, as far out as the light's fall moves it, tapering where that edge turns.
 */
function layHeapShadow(hand: Hand, shape: ScreeShape): void {
  if (!hand.scene.env.view.shadow) return;
  const { outline } = shape;
  const mid = outline.reduce((m, p) => ({ x: m.x + p.x / outline.length, y: m.y + p.y / outline.length }), { x: 0, y: 0 });
  const away = outline.map(p => (p.x - mid.x) * SHADOW_DIR.x + (p.y - mid.y) * SHADOW_DIR.y > 0);
  // The longest run of the outline facing away from the light, round the ring.
  const start = away.findIndex((a, i) => a && !away[(i + outline.length - 1) % outline.length]);
  if (start < 0) return;
  const run: Vec[] = [];
  for (let k = 0; k < outline.length && away[(start + k) % outline.length]; k++) run.push(outline[(start + k) % outline.length]!);
  const d = 0.07;
  const out = run.map((p, i) => {
    const taper = Math.sin(Math.PI * (i / Math.max(1, run.length - 1)));
    return { x: p.x + SHADOW_DIR.x * d * taper, y: p.y + SHADOW_DIR.y * d * taper };
  });
  fill(hand, polyPath([...run, ...out.reverse()]), withAlpha('#000000', 0.2));
}

/**
 * Hachures: short strokes down the fall line, tapering from their top, set in rows along the slope's
 * contours, close together and long where it is steep (under the crest) and sparser and shorter
 * below, as cartographers draw a slope; heavier on its shaded flank. `rows` how far down they go.
 */
export function drawHachures(hand: Hand, frame: WayFrame, shape: ScreeShape, rows: number, seed: number): void {
  const { at, along } = frame;
  const side = litSide(frame);
  const wedges: Vec[][] = [];
  const steep = Math.min(1, 2.4 / along);
  let t = 0.015;
  for (let row = 0; row < rows; row++) {
    const length = (0.17 - row * 0.03) * (0.7 + 0.3 * steep);
    const gap = 0.045 + row * 0.018;
    const half = shape.width(t) - 0.04;
    const count = Math.max(3, Math.round(half * 2 / gap));
    for (let i = 0; i <= count; i++) {
      const s = (i + 0.5 * (valueNoise(i * 2.3, row * 3.1, seed) - 0.5)) / count * 2 - 1;
      if (Math.abs(s) > 1) continue;
      const shade = 1 + 0.55 * -s * side;
      const width = 0.018 * shade * (1 - row * 0.12);
      const len = length * (0.65 + 0.5 * valueNoise(i * 1.3, row + 5, seed));
      const v = shape.vAt(t) + 0.02 * valueNoise(i * 3.3, row, seed);
      const u = s * half;
      // Each stroke follows the tongue's spread a little, as the fall line fans out.
      const spread = (shape.width(t + len / along) / shape.width(t) - 1) * u;
      wedges.push([at(u - width / 2, v), at(u + width / 2, v), at(u + spread + width * 0.08, v + len), at(u + spread - width * 0.08, v + len)]);
    }
    t += (length * 0.8 + 0.02) / along;
  }
  const { ctx } = hand.scene.env;
  ctx.save();
  ctx.beginPath();
  polysPath(wedges)(ctx);
  ctx.fillStyle = hand.paint('rock').ink;
  ctx.fill();
  ctx.restore();
}

/** Runnels down the slope where loose stone has slid (Stone; ink has its hachures). */
export function drawRunnels(hand: Hand, frame: WayFrame, shape: ScreeShape, seed: number): void {
  const c = stoneOf(hand);
  if (!c || !hand.scene.raster) return;
  const { at } = frame;
  const count = 2;
  const runs: Vec[][] = [];
  for (let i = 0; i < count; i++) {
    const s = ((i + 0.5) / count * 2 - 1) * 0.85 + (valueNoise(i * 1.9, 4, seed) - 0.5) * 0.2;
    const start = 0.12 + 0.2 * valueNoise(i * 3.1, 2, seed);
    const end = start + 0.18 + 0.22 * valueNoise(i * 2.7, 6, seed);
    const run: Vec[] = [];
    for (let k = 0; k <= 6; k++) {
      const t = start + (end - start) * k / 6;
      run.push(at(s * shape.width(t) + 0.045 * (valueNoise(i * 7 + k * 0.8, 8, seed) - 0.5), shape.vAt(t)));
    }
    runs.push(run);
  }
  hand.line(runs, 'fine');
}

/** Loose stones' contact shadows: Stone lays each stone's shape again a little down the light's fall, under it. */
export function layRubbleShadow(hand: Hand, stones: readonly Vec[][], lift: number): void {
  const { env } = hand.scene;
  if (env.style.direction !== 'stone' || !env.view.shadow) return;
  fill(hand, polysPath(stones.map(poly => poly.map(p => ({ x: p.x + SHADOW_DIR.x * lift, y: p.y + SHADOW_DIR.y * lift })))), withAlpha('#000000', 0.38));
}

/**
 * The part of a slope between `t0` and `t1` of the way down, with both edges wandering, so where a
 * tone or the grit changes reads as a thinning across loose stone, never as a ruled line.
 */
export function slopeBand(frame: WayFrame, t0: number, t1: number): Vec[] {
  const { at, across, along } = frame;
  const edge = (t: number, reverse: boolean): Vec[] => {
    const points = Array.from({ length: 9 }, (_, i) => at((i / 8 - 0.5) * across, (t - 0.5 + (t > 0 && t < 1 ? 0.07 * Math.sin(i * 2.3 + t * 11) : 0)) * along));
    return reverse ? points.reverse() : points;
  };
  return [...edge(t0, false), ...edge(t1, true)];
}
