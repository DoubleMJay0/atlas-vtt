import type { Rng } from '../rng';
import type { Bounds, Vec } from './geometry';

/** Candidates tried around an active sample before it retires (Bridson's k). */
const ATTEMPTS = 18;

/**
 * Poisson-disc samples at least `radius` apart, grown from `seeds` through the region `inside`
 * accepts (Bridson). The order is the order of growth, so neighbours in the list lie close.
 */
export function poissonDisc(bounds: Bounds, radius: number, inside: (x: number, y: number) => boolean, seeds: readonly Vec[], rng: Rng): Vec[] {
  const cell = radius / Math.SQRT2;
  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell) + 1);
  const rows = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / cell) + 1);
  const grid = new Int32Array(cols * rows).fill(-1);
  const samples: Vec[] = [];
  const active: number[] = [];
  const r2 = radius * radius;

  const slot = (x: number, y: number): number => {
    const gx = Math.floor((x - bounds.minX) / cell);
    const gy = Math.floor((y - bounds.minY) / cell);
    return gx < 0 || gy < 0 || gx >= cols || gy >= rows ? -1 : gy * cols + gx;
  };
  const free = (x: number, y: number): boolean => {
    const gx = Math.floor((x - bounds.minX) / cell);
    const gy = Math.floor((y - bounds.minY) / cell);
    for (let j = Math.max(0, gy - 2); j <= Math.min(rows - 1, gy + 2); j++) {
      for (let i = Math.max(0, gx - 2); i <= Math.min(cols - 1, gx + 2); i++) {
        const other = grid[j * cols + i]!;
        if (other < 0) continue;
        const s = samples[other]!;
        const dx = s.x - x;
        const dy = s.y - y;
        if (dx * dx + dy * dy < r2) return false;
      }
    }
    return true;
  };
  const add = (x: number, y: number): void => {
    const index = slot(x, y);
    if (index < 0) return;
    grid[index] = samples.length;
    active.push(samples.length);
    samples.push({ x, y });
  };

  for (const seed of seeds) {
    if (inside(seed.x, seed.y) && free(seed.x, seed.y)) add(seed.x, seed.y);
    while (active.length) {
      const pick = Math.floor(rng() * active.length);
      const origin = samples[active[pick]!]!;
      let placed = false;
      for (let k = 0; k < ATTEMPTS; k++) {
        const a = rng() * Math.PI * 2;
        const d = radius * (1 + rng());
        const x = origin.x + Math.cos(a) * d;
        const y = origin.y + Math.sin(a) * d;
        if (slot(x, y) < 0 || !inside(x, y) || !free(x, y)) continue;
        add(x, y);
        placed = true;
        break;
      }
      if (!placed) {
        active[pick] = active[active.length - 1]!;
        active.pop();
      }
    }
  }
  return samples;
}

/** Points just outside every floor shape's edge, so growth reaches each part of a band. */
export function edgeSeeds(boxes: readonly Bounds[], outward: number): Vec[] {
  const seeds: Vec[] = [];
  for (const b of boxes) {
    const cx = (b.minX + b.maxX) / 2;
    seeds.push({ x: cx, y: b.minY - outward }, { x: cx, y: b.maxY + outward });
    const cy = (b.minY + b.maxY) / 2;
    seeds.push({ x: b.minX - outward, y: cy }, { x: b.maxX + outward, y: cy });
  }
  return seeds;
}
