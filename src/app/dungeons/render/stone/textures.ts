import { periodicFbm, standardised } from '../art/noise';
import { plateAt, plateValue } from '../art/plates';

/**
 * Seamless surfaces of Stone & shadow, made once per colour: heightfields lit from the top left,
 * so a texture carries the same light as the shadows on the map.
 */

/** Rock tiles: their side in texels, the cells they cover, and their plates across. */
export const ROCK_TILE = { px: 768, cells: 3, plates: 7, seed: 0x51a7e };

const LIGHT = (() => {
  const l = [-0.5, -0.5, 0.71];
  const n = Math.hypot(...l);
  return l.map(v => v / n) as [number, number, number];
})();

const cache = new Map<string, OffscreenCanvas>();

function canvasOf(size: number, rgba: Uint8ClampedArray<ArrayBuffer>): OffscreenCanvas {
  const canvas = new OffscreenCanvas(size, size);
  canvas.getContext('2d')!.putImageData(new ImageData(rgba, size), 0, 0);
  return canvas;
}

/** Lambert shade of a wrapping heightfield at each texel, `relief` scaling its slopes. */
function shadeOf(h: Float32Array, size: number, relief: number): Float32Array {
  const out = new Float32Array(size * size);
  const at = (x: number, y: number): number => h[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * relief;
      const dy = (at(x, y + 1) - at(x, y - 1)) * relief;
      out[y * size + x] = (-dx * LIGHT[0] - dy * LIGHT[1] + LIGHT[2]) / Math.hypot(dx, dy, 1);
    }
  }
  return out;
}

/**
 * Natural rock: a few large masses split by deep fissures, finer cracks running through them here
 * and there and dying out, its surface worn and grained, lit from the top left. The fine cracks
 * are `plateAt`'s plates, so a mask can break the rock off along them. Drawn as deviations (white
 * lightens, black darkens), so one tile serves every colour.
 */
export function rockTile(): OffscreenCanvas {
  const key = 'rock';
  const known = cache.get(key);
  if (known) return known;
  const { px: size, plates, seed } = ROCK_TILE;
  const grain = periodicFbm(size, 40, seed + 1, 3, 0.55).values;
  const wear = periodicFbm(size, 4, seed + 2, 6, 0.55).values;
  const show = periodicFbm(size, 5, seed + 4, 3, 0.5).values;
  const tint = standardised(periodicFbm(size, 3, seed + 3, 4).values);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      // The lattices are warped, so the cracks wander instead of running straight.
      const wx = (wear[k]! - 0.5) * 0.9;
      const wy = (show[(k + size * 37) % h.length]! - 0.5) * 0.9;
      const u = (x / size) * plates + wx;
      const v = (y / size) * plates + wy;
      const fine = plateAt(u, v, plates, seed);
      const mu = (x / size) * 3 + wx * 0.6;
      const mv = (y / size) * 3 + wy * 0.6;
      const mass = plateAt(mu, mv, 3, seed + 5);
      const lift = plateValue(mass.nearest, 3, seed + 5);
      // Fissures between the masses run deep; the fine cracks show where `show` lets them, fading out.
      const fissure = Math.exp(-(mass.f2 - mass.f1) / 0.025);
      const crack = Math.exp(-(fine.f2 - fine.f1) / 0.018) * Math.max(0, Math.min(1, (show[k]! - 0.48) * 6));
      const tilt = ((mu - mass.nearest.x) * Math.cos(lift * 9) + (mv - mass.nearest.y) * Math.sin(lift * 9)) * 0.12;
      h[k] = lift * 0.12 + tilt + wear[k]! * 0.55 + grain[k]! * 0.035 - fissure * 0.22 - crack * 0.1;
    }
  }
  const shade = shadeOf(h, size, size * 0.22);
  const out = new Uint8ClampedArray(size * size * 4);
  for (let k = 0; k < h.length; k++) {
    const d = (shade[k]! - 0.74) * 0.6 + tint[k]! * 0.03;
    const v = d > 0 ? 255 : 0;
    out[k * 4] = v;
    out[k * 4 + 1] = v;
    out[k * 4 + 2] = v;
    out[k * 4 + 3] = Math.min(255, Math.abs(d) * 255);
  }
  const canvas = canvasOf(size, out);
  cache.set(key, canvas);
  return canvas;
}

/**
 * The grain of dressed stone as deviations from the surface: black and white texels whose alpha
 * moves its brightness by a few percent, so it lies over any colour.
 */
export function grainTile(strength: number, size = 256): OffscreenCanvas {
  const key = `grain:${strength}:${size}`;
  const known = cache.get(key);
  if (known) return known;
  const fine = periodicFbm(size, 16, 0x9a1, 3).values;
  const broad = periodicFbm(size, 4, 0x9a2, 4).values;
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = fine[i]! * 0.35 + broad[i]! * 0.65;
  const shade = standardised(shadeOf(h, size, size * 0.15));
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < h.length; i++) {
    const d = shade[i]! * strength;
    const v = d > 0 ? 255 : 0;
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = Math.min(255, Math.abs(d) * 255);
  }
  const canvas = canvasOf(size, out);
  cache.set(key, canvas);
  return canvas;
}

/**
 * The grain of wood: long fibres along x with a knot here and there, as deviations like the
 * stone's grain, so planks keep their own colour.
 */
export function woodTile(strength: number, size = 256): OffscreenCanvas {
  const key = `wood:${strength}:${size}`;
  const known = cache.get(key);
  if (known) return known;
  const along = periodicFbm(size, 4, 0x3d1, 4).values;
  const fibre = periodicFbm(size, 64, 0x3d2, 2).values;
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      const ring = Math.sin((y / size) * Math.PI * 2 * 9 + along[k]! * 9) * 0.5 + 0.5;
      const d = ((ring - 0.5) * 0.7 + (fibre[((y * 7) % size) * size + x]! - 0.5) * 0.6) * strength;
      const v = d > 0 ? 255 : 0;
      out[k * 4] = v;
      out[k * 4 + 1] = v;
      out[k * 4 + 2] = v;
      out[k * 4 + 3] = Math.min(255, Math.abs(d) * 255);
    }
  }
  const canvas = canvasOf(size, out);
  cache.set(key, canvas);
  return canvas;
}
