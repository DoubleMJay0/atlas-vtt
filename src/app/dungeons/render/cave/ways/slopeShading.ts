import type { StairEnd } from '../../../floors/stairSpots';
import type { Hand } from '../../art/hand';
import { SHADOW_DIR } from '../../art/light';
import { polyPath, polysPath, type PathFn } from '../../art/paths';
import { pointsBounds, type Vec } from '../../geometry';
import { withAlpha } from '../../palette';
import { stoneOf } from './wayColours';
import type { WayFrame } from './narrows';

/**
 * A slope's light along its fall line: lit at a crest on this floor, sinking into the dark where it
 * goes down to the floor below (`upper`), in the ceiling's shadow where it comes up from below
 * (`lower`), a little darker towards the toe between rooms of one floor. Stone lays it as one
 * gradient (raster pictures only; an SVG keeps the slope's lines), Engraved as hatching.
 */
/** Engraved's bands along a slope (from, to, tone), only where it darkens: hatching costs by the area it covers. */
const ENGRAVED_BANDS: Record<StairEnd | 'steps', readonly (readonly [number, number, number])[]> = {
  upper: [[0.58, 1.2, 0.55]],
  lower: [[-0.2, 0.24, 0.4]],
  steps: [[0.62, 1.2, 0.2]],
};

export function laySlopeTone(hand: Hand, frame: WayFrame, path: PathFn, end?: StairEnd): void {
  const { env } = hand.scene;
  const tone = (t: number): number => {
    if (end === 'upper') return 0.88 * Math.max(0, (t - 0.3) / 0.7) ** 1.5;
    if (end === 'lower') return 0.5 * Math.max(0, 1 - t / 0.45) ** 1.6;
    return 0.28 * Math.max(0, (t - 0.4) / 0.6);
  };
  if (env.style.direction !== 'stone') {
    // In bands of one tone each, inside the slope: a hatching whose lines swell costs three times one that keeps its width.
    const { ctx } = env;
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.clip();
    for (const [t0, t1, level] of ENGRAVED_BANDS[end ?? 'steps']) {
      const corners = slopeBand(frame, t0, t1);
      hand.tone(() => level, pointsBounds(corners), polyPath(corners), 'shade');
    }
    ctx.restore();
    return;
  }
  if (!hand.scene.raster) return;
  const c = stoneOf(hand)!;
  const { ctx } = env;
  const a = frame.at(0, -frame.along / 2);
  const b = frame.at(0, frame.along / 2);
  const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  const lit = end === 'lower' ? 0 : c.dark ? 0.16 : 0.22;
  gradient.addColorStop(0, withAlpha(lit ? c.light : '#000000', lit || tone(0)));
  for (const t of [0.25, 0.5, 0.75, 1]) gradient.addColorStop(t, withAlpha('#000000', tone(t)));
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

/** Loose stones' contact shadows: Stone lays each stone's shape again a little down the light's fall, under it. */
export function layRubbleShadow(hand: Hand, stones: readonly Vec[][], lift: number): void {
  const { env } = hand.scene;
  if (env.style.direction !== 'stone' || !env.view.shadow) return;
  const { ctx } = env;
  ctx.save();
  ctx.beginPath();
  polysPath(stones.map(poly => poly.map(p => ({ x: p.x + SHADOW_DIR.x * lift, y: p.y + SHADOW_DIR.y * lift }))))(ctx);
  ctx.fillStyle = withAlpha('#000000', 0.38);
  ctx.fill();
  ctx.restore();
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
