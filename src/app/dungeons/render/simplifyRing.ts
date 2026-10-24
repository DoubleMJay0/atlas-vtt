/** A closed ring with fewer corners: Douglas–Peucker, keeping every corner the ring strays from by more than a tolerance. */

import type { Vec } from './geometry';

/** Points of a closed ring kept by Douglas–Peucker within `tolerance`. */
export function simplifyRing(ring: readonly Vec[], tolerance: number): Vec[] {
  const keep = new Uint8Array(ring.length);
  const stack: [number, number][] = [[0, Math.floor(ring.length / 2)], [Math.floor(ring.length / 2), ring.length]];
  keep[0] = 1;
  keep[Math.floor(ring.length / 2)] = 1;
  while (stack.length) {
    const [from, to] = stack.pop()!;
    const a = ring[from]!;
    const b = ring[to % ring.length]!;
    let far = -1;
    let farthest = tolerance;
    for (let i = from + 1; i < to; i++) {
      const d = segmentDistance(ring[i]!, a, b);
      if (d > farthest) {
        farthest = d;
        far = i;
      }
    }
    if (far < 0) continue;
    keep[far] = 1;
    stack.push([from, far], [far, to]);
  }
  return ring.filter((_, i) => keep[i]);
}

function segmentDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
