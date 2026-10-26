import type { StairEnd } from '../../../floors/stairSpots';
import { rngFrom } from '../../../rng';
import type { PileStone } from '../../art/hand';
import { valueNoise } from '../../art/noise';
import type { Vec } from '../../geometry';
import { chiselled, stoneOutline } from '../../terrain/stones';
import type { WayFrame } from './narrows';

/**
 * A scree slope as a cutting into the rock: a ramp of loose stone between two rock faces. From the
 * floor above (`upper`) the cutting starts level with the floor at the near end and sinks: its faces
 * widen as the floor drops away beside the ramp, until the ramp runs in under a brow of rock into
 * the dark. From the floor below (`lower`) the same slope comes down out of a dark opening under the
 * ceiling, raised between faces that sink to nothing as it reaches the floor at its foot. Between
 * rooms of one floor (no end) the cutting sinks to the lower room and stays open at its foot.
 * `t` runs from the slope's high end (0) to its low end (1), whichever way the floor shown sees it.
 */
export interface ScreeShape {
  /** The ramp's walkable surface, its mouth included. */
  ramp: Vec[];
  /** Each face as a polygon, and which side of the ramp it lies on (−1, +1 of `u`). */
  faces: { poly: Vec[]; side: number }[];
  /** The faces' outer edges, where the floor breaks off (`upper`) or the raised ramp meets the floor (`lower`). */
  rims: Vec[][];
  /** The ramp's edges, at the foot of each face. */
  edges: Vec[][];
  /** The brow of rock the ramp runs in under (`upper`), or the ceiling's edge it comes out from (`lower`); none between rooms. */
  brow: Vec[] | null;
  /** The dark opening under the ceiling the slope comes out of, between the brow and the stairwell's end (`lower` only). */
  opening: Vec[] | null;
  /** The frame's `v` at `t`. */
  vAt: (t: number) => number;
  /** The cutting's outline (rims and brow) between `t0` and `t1`: where its depth is laid. */
  outlineBetween: (t0: number, t1: number) => Vec[];
  /** Half the ramp's width at `t`. */
  halfRamp: (t: number) => number;
  stones: PileStone[];
}

const N = 12;

export function screeShape(frame: WayFrame, seed: number, end?: StairEnd): ScreeShape {
  const { at, along, across } = frame;
  const lower = end === 'lower';
  const upper = end === 'upper';
  // The ramp runs from the stairwell's near end to its far end; on the floor above, it stops at the brow.
  const brow = upper ? Math.min(0.24, along * 0.1) : 0;
  const vHigh = -along / 2 + (lower ? Math.min(0.3, along * 0.14) : 0.04);
  const vLow = along / 2 - 0.05 - brow;
  const vAt = (t: number): number => vHigh + (vLow - vHigh) * t;
  // The rim wanders as broken rock does, and draws in a little at the near end, where the cutting begins.
  const rim = (t: number, side: number): number => across / 2 - 0.05 - 0.08 * valueNoise(t * 4, side * 3, seed) - 0.035 * valueNoise(t * 13, side * 7, seed) - 0.06 * Math.max(0, 1 - t / 0.12) * (lower ? 0 : 1);
  // The faces show the drop beside the ramp: nothing where the ramp is level with the floor, widening with depth.
  const depth = (t: number): number => (lower ? 1 - t : t);
  // A short slope drops less, so its faces stay narrower.
  const drop = Math.min(1, along / 2.5);
  const face = (t: number): number => Math.min(across * 0.27, 0.02 + 0.3 * drop * depth(t) ** 1.15);
  const halfRamp = (t: number): number => rim(t, 1) - face(t);
  const ts = Array.from({ length: N + 1 }, (_, i) => i / N);
  const edge = (side: number, inner: boolean): Vec[] => ts.map(t => {
    const r = rim(t, side);
    // The face's foot is ledged: it steps in and out as the rock broke.
    const w = inner ? r - face(t) * (0.75 + 0.5 * valueNoise(t * 11, side * 5 + 1, seed)) : r;
    return at(side * w, vAt(t));
  });
  const faces = [-1, 1].map(side => ({ poly: [...edge(side, false), ...edge(side, true).reverse()], side }));
  const rims = [-1, 1].map(side => edge(side, false));
  const edges = [-1, 1].map(side => edge(side, true));
  // The brow: an edge of broken rock across the ramp, bowed back where the ramp runs in under it.
  let browLine: Vec[] | null = null;
  let opening: Vec[] | null = null;
  if (upper || lower) {
    const t = lower ? 0 : 1;
    const v = vAt(t);
    const r = rim(t, 1);
    browLine = Array.from({ length: 11 }, (_, i) => {
      const s = i / 10 * 2 - 1;
      const bow = (lower ? -1 : 1) * 0.1 * (1 - s * s) + 0.05 * (valueNoise(i * 2.1, 9, seed) - 0.5);
      return at(s * r, v + bow);
    });
    if (lower) {
      // An arch of dark under the ceiling: from the brow back towards the stairwell's end, rounded.
      const deep = vHigh - (-along / 2 + 0.03);
      const back = Array.from({ length: 11 }, (_, i) => {
        const s = 1 - i / 10 * 2;
        return at(s * r * (0.92 - 0.1 * s * s), v - deep * Math.sqrt(1 - s * s * 0.85) + 0.02 * (valueNoise(i * 3.1, 4, seed) - 0.5));
      });
      opening = chiselled([...browLine, ...back], seed + 4, 0.02);
    }
  }
  const left = edges[0]!;
  const right = edges[1]!;
  // Round the ramp: down its left edge, across under the brow at its low end (`upper`), up its right
  // edge, and across the ceiling's edge at its high end (`lower`).
  const ramp = [...left, ...(upper && browLine ? browLine : []), ...right.slice().reverse(), ...(lower && browLine ? browLine.slice().reverse() : [])];
    const outlineBetween = (t0: number, t1: number): Vec[] => {
    const [i0, i1] = [Math.max(0, Math.floor(t0 * N)), Math.min(N, Math.ceil(t1 * N))];
    const l = rims[0]!.slice(i0, i1 + 1);
    const r = rims[1]!.slice(i0, i1 + 1).reverse();
    const low = upper && i1 === N && browLine ? browLine : [];
    const high = lower && i0 === 0 && browLine ? browLine.slice().reverse() : [];
    return [...l, ...low, ...r, ...high];
  };
  return { ramp, faces, rims, edges, brow: browLine, opening, outlineBetween, vAt, halfRamp, stones: stonesOf(frame, vAt, halfRamp, end, seed) };
}

/**
 * Stones lying in rows across the slope, along its contours, as scree settles: few and small near
 * its high end, cobbles and boulders low down, where they gather; from the floor below they spill
 * out past the ramp's foot onto the floor.
 */
function stonesOf(frame: WayFrame, vAt: (t: number) => number, half: (t: number) => number, end: StairEnd | undefined, seed: number): PileStone[] {
  const { at, along } = frame;
  const rng = rngFrom(seed);
  const stones: PileStone[] = [];
  // The low end lies at t = 1 everywhere; rows closer together down the slope, where the stones gather.
  const rows = Math.max(3, Math.round(along * 1.4));
  for (let k = 0; k < rows; k++) {
    // On the floor above, rows stop where the mouth's dark would swallow them.
    const t = 0.1 + (end === 'upper' ? 0.76 : 0.88) * Math.sqrt((k + 0.4 * rng()) / rows);
    // Below the size that shows facets (the boulders added after are the few that do).
    const r0 = 0.026 + 0.03 * t ** 1.4;
    const w = half(Math.min(1, t)) - r0 - 0.02;
    if (w <= 0) continue;
    const count = Math.max(1, Math.round(w * 2 / (r0 * 3.2 + 0.05)));
    const shift = rng();
    for (let i = 0; i < count; i++) {
      // A row is never full: stones lie in its runs, with gaps between.
      if (rng() < 0.45) continue;
      const r = Math.min(0.056, r0 * (0.7 + 0.6 * rng()));
      const slot = (i + shift + (rng() - 0.5) * 0.9 + count) % count;
      const u = (slot / count * 2 - 1) * w;
      // Each row wanders along the slope, as a contour does.
      const c = at(u, vAt(t) + 0.1 * (valueNoise(u * 3, k, seed) - 0.5) + (rng() - 0.5) * 0.05);
      stones.push({ poly: stoneOutline(rng, c, r), c, r });
    }
  }
  // A few boulders low on the slope, the stones that rolled farthest, faceted where the look models them.
  for (let i = 0; i < 2; i++) {
    const t = end === 'lower' ? 0.8 + 0.15 * rng() : 0.58 + 0.2 * rng();
    const r = 0.068 + 0.03 * rng();
    const c = at(((i + 0.5) / 2 * 2 - 1) * Math.max(0, half(t) - r - 0.03) + (rng() - 0.5) * 0.08, vAt(t));
    stones.push({ poly: stoneOutline(rng, c, r), c, r });
  }
  if (end === 'lower') {
    // Spilled past the foot onto the floor below.
    for (let i = 0; i < 4; i++) {
      const r = 0.035 + 0.04 * rng();
      const c = at((rng() * 2 - 1) * half(1) * 0.9, Math.min(along / 2 - r - 0.02, vAt(1) + 0.02 + 0.06 * rng()));
      stones.push({ poly: stoneOutline(rng, c, r), c, r });
    }
  }
  return stones;
}
