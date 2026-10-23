import { hash2, valueNoise } from './noise';
import { smoothstep } from './paths';

/**
 * Molten rock under a crust of cooling plates: the plates (a warped Worley field) black at heart
 * and glowing at their rims, the melt in the seams between them opening wider and hotter away from
 * the shore. Colours per point, shared by every look that draws lava.
 */

function worley(x: number, y: number, seed: number): { f1: number; f2: number } {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = Infinity;
  let f2 = Infinity;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i + hash2(ix + i, iy + j, seed);
      const cy = iy + j + hash2(ix + i, iy + j, seed + 1);
      const d = Math.hypot(cx - x, cy - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2 };
}

export type Molten = 'lava' | 'acid';

const HOT: Record<Molten, { crust: [number, number, number]; ember: [number, number, number]; melt: [number, number, number]; core: [number, number, number] }> = {
  lava: { crust: [28, 18, 16], ember: [150, 46, 22], melt: [255, 96, 22], core: [255, 220, 110] },
  acid: { crust: [26, 34, 18], ember: [70, 120, 30], melt: [150, 230, 60], core: [230, 255, 170] },
};

/** The colour of molten rock `d` cells in from its shore at (x, y), into `out` at `o`. */
export function moltenAt(kind: Molten, x: number, y: number, d: number, out: Uint8ClampedArray, o: number): void {
  if (d <= 0) return;
  const c = HOT[kind];
  const warp = valueNoise(x * 1.7, y * 1.7, 44) - 0.5;
  const { f1, f2 } = worley(x * 3.1 + warp * 0.8, y * 3.1 - warp * 0.8, 43);
  const seam = f2 - f1;
  const heat = smoothstep(0.05, 0.8, d);
  const open = 0.05 + 0.12 * heat + 0.05 * (valueNoise(x * 4, y * 4, 45) - 0.5);
  const molten = (1 - smoothstep(open * 0.35, open, seam)) * smoothstep(0.02, 0.1, d);
  const core = 1 - smoothstep(0, open * 0.45, seam);
  const ember = Math.exp(-seam / 0.12) * (0.35 + 0.4 * heat);
  for (let ch = 0; ch < 3; ch++) {
    const crust = c.crust[ch]! + (c.ember[ch]! - c.crust[ch]!) * ember;
    const melt = c.melt[ch]! + (c.core[ch]! - c.melt[ch]!) * core * (0.6 + 0.4 * heat);
    out[o + ch] = crust * (1 - molten) + melt * molten;
  }
  out[o + 3] = 255 * smoothstep(0, 0.01, d);
}

/** The glow a pool of `kind` throws onto the floor round it. */
export const GLOW: Record<Molten, [number, number, number]> = { lava: [255, 110, 35], acid: [140, 230, 60] };
