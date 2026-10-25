import { BOUNCE } from '../../../lighting/lightingConstants';
import type { Rect } from '../../../lighting/segments';
import { sameCone } from '../../../vision/visionCone';
import type { DrawnDarkness } from './DarknessMap';
import { drawnRect, union, type DrawnLight } from './LightMap';

/** What the steady light map drew, by light, in its order. */
export type SteadyDrawing = ReadonlyMap<string, DrawnLight | DrawnDarkness>;

/** Where cascade `i`'s intervals start; each is four times longer than the last. */
export function intervalStart(i: number): number {
  return (BOUNCE.interval * (4 ** i - 1)) / 3;
}

/**
 * How far from a change of the light map the bounce can change: a probe of the top cascade reads
 * the floor up to its interval's end, and each cascade below reads the probes of the one above
 * up to √2 of their spacing away (`cascadeFragment`), plus the emission's bilinear read.
 */
export const BOUNCE_REACH = intervalStart(BOUNCE.cascades)
  + Array.from({ length: BOUNCE.cascades - 1 }, (_, i) => Math.SQRT2 * BOUNCE.probe * 2 ** (i + 1)).reduce((sum, d) => sum + d, 0)
  + 2 * BOUNCE.emitTexel;

/**
 * The world rect of the light map that differs between two steady drawings (each changed light's
 * rect before and now), or null where the whole map must be taken as changed: no drawing before,
 * a darkness in either (it erases over its area), or no light that differs.
 */
export function changedArea(before: SteadyDrawing | null, now: SteadyDrawing): Rect | null {
  if (!before) return null;
  let area: Rect | null = null;
  const add = (light: DrawnLight | DrawnDarkness | undefined): boolean => {
    if (!light) return true;
    if ('polygon' in light) return false;
    area = area ? union(area, drawnRect(light)) : drawnRect(light);
    return true;
  };
  for (const [key, light] of now) {
    const old = before.get(key);
    if (old && sameDrawing(old, light)) continue;
    if (!add(light) || !add(old)) return null;
  }
  for (const [key, old] of before) if (!now.has(key) && !add(old)) return null;
  return area;
}

function sameDrawing(a: DrawnLight | DrawnDarkness, b: DrawnLight | DrawnDarkness): boolean {
  if ('polygon' in a || 'polygon' in b) return false;
  return a.tile === b.tile && a.reflection === b.reflection && a.bright === b.bright && a.dim === b.dim && a.intensity === b.intensity
    && a.color.every((c, i) => c === b.color[i]) && sameCone(a.cone, b.cone) && a.edge === b.edge;
}
