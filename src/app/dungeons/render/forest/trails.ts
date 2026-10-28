import type { WayOut } from '../cave/mouth/wayOut';
import { wayCentre, wayHalf, wayPoint } from '../cave/mouth/wayOut';
import type { Vec } from '../geometry';

/** Steps a trail's outline is sampled at along it, in cells. */
const STEP = 0.25;

/**
 * A trail's ground: the band of a Forest's way out from its mouth to its far end, along its winding
 * middle at the width it has there, closed round its far end, where it narrows to a footpath and
 * fades into the woods (`trailFade`).
 */
export function trailRing(way: WayOut): Vec[] {
  const steps = Math.max(2, Math.ceil(way.length / STEP));
  const u = (k: number): number => -0.1 + ((way.length + 0.1) * k) / steps;
  // The far end narrows to a footpath, as the path leaves the clearing behind.
  const narrow = (k: number): number => 1 - 0.55 * (k / steps) ** 1.5;
  const left = Array.from({ length: steps + 1 }, (_, k) => wayPoint(way, u(k), wayCentre(way, u(k)) - wayHalf(way, u(k), -1) * narrow(k)));
  const right = Array.from({ length: steps + 1 }, (_, k) => wayPoint(way, u(k), wayCentre(way, u(k)) + wayHalf(way, u(k), 1) * narrow(k)));
  return [...left, ...right.reverse()];
}

/** How strongly a trail's worn ground shows `u` cells out: growing out of the clearing over its first cell, whole on, fading over its last third into the woods. */
export function trailFade(way: WayOut, u: number): number {
  const start = Math.max(0, Math.min(1, (u + 0.1) / 1.1));
  const t = Math.max(0, u) / way.length;
  return start * start * (3 - 2 * start) * (t < 0.66 ? 1 : Math.max(0, 1 - (t - 0.66) / 0.34));
}
