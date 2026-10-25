import { rngFrom } from '../../../rng';
import { valueNoise } from '../../art/noise';
import type { Vec } from '../../geometry';
import { chiselled, stoneOutline } from '../../terrain/stones';
import type { WayFrame } from './narrows';

/**
 * The shape of a scree slope: a tongue of loose rock spilling from a lip at its crest, narrow there
 * and widening downslope, its flanks wandering and its toe frayed into lobes; and its stones, sorted
 * as scree sorts, grit near the crest, cobbles lower down, boulders clumped at the foot and a few
 * spilled past it. `t` runs from the crest (0) to the toe (1); `u` across the way, as in the frame.
 */
export interface ScreeShape {
  outline: Vec[];
  /** The crest, from one flank to the other: where the slope leaves the higher ground. */
  crest: Vec[];
  /** The rock lip the crest is tucked under, on the higher ground. */
  lip: Vec[];
  /** Both flanks from the crest down, broken into runs where the loose edge frays. */
  flanks: Vec[][];
  /** Half the tongue's width at `t`. */
  width: (t: number) => number;
  /** The frame's `v` at `t`. */
  vAt: (t: number) => number;
  stones: Stone[];
}

export interface Stone { poly: Vec[]; c: Vec; r: number }

/** Room the lip takes above the crest, in cells. */
const LIP = 0.2;
/** Where the flanks end and the toe begins to round off, of the way down: sooner on a short slope, so its toe still rounds. */
const toeAt = (along: number): number => (along < 2.5 ? 0.58 : 0.72);

export function screeShape(frame: WayFrame, seed: number): ScreeShape {
  const { at, along, across } = frame;
  const top = -along / 2 + Math.min(LIP + 0.04, along * 0.2);
  const foot = along / 2 - 0.04;
  const narrow = across / 2 * 0.42;
  const wide = across / 2 - 0.05;
  // A tongue: it swells quickly below the crest, holds its width, and rounds off into its toe.
  const width = (t: number): number => {
    const swell = narrow + (wide - narrow) * Math.sin(Math.PI / 2 * Math.min(1, t / 0.7)) ** 0.8;
    return t <= 0.72 ? swell : wide * Math.sqrt(Math.max(0, 1 - ((t - 0.72) / 0.3) ** 2)) * 0.25 + swell * 0.75;
  };
  const vAt = (t: number): number => top + (foot - top) * t;
  const toeStart = toeAt(along);
  // The flanks wander more the farther down they run: loose rock frays as it spreads.
  const wander = (sign: number, t: number): number => (0.03 + 0.07 * t) * (valueNoise(t * 5, sign * 4, seed) - 0.5) * 2 + 0.045 * (valueNoise(t * 19, sign * 9, seed) - 0.5);
  const n = 12;
  const crest: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n * 2 - 1;
    crest.push(at(s * narrow, top + 0.04 * (1 - s * s) + 0.035 * (valueNoise(i * 1.9, 2, seed) - 0.5)));
  }
  const side = (sign: number): Vec[] => Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / (n + 1) * toeStart;
    return at(sign * (width(t) + wander(sign, t)), vAt(t));
  });
  // The toe: rounded, reaching farthest near its middle, in lobes where the stones ran on.
  const toe: Vec[] = [];
  const m = 14;
  for (let i = 0; i <= m; i++) {
    const a = Math.PI * (i / m);
    const s = Math.cos(a);
    const lobe = 0.13 * (valueNoise(i * 1.4, 11, seed) - 0.5) * 2 + 0.05 * Math.sin(i * 2.9 + seed % 7) + 0.03 * (valueNoise(i * 4.1, 3, seed) - 0.5);
    // Short of the stairwell's end by the lobes' reach, so a lobe never meets it in a straight line.
    const reach = vAt(toeStart) + (foot - 0.13 - vAt(toeStart)) * Math.sin(a) + lobe * Math.sin(a);
    toe.push(at(s * (width(toeStart) + wander(Math.sign(s) || 1, toeStart)) * (0.8 + 0.2 * Math.sin(a)), Math.min(along / 2 - 0.03, reach)));
  }
  const right = side(1);
  const left = side(-1).reverse();
  const outline = [...crest, ...right, ...toe, ...left];
  const lip = lipOf([...left.slice(-3), ...crest, ...right.slice(0, 3)], frame, seed);
  return { outline, crest, lip, flanks: [...frayed([crest[n]!, ...right], seed), ...frayed([crest[0]!, ...left.slice().reverse()], seed + 1)], width, vAt, stones: stonesOf(frame, width, vAt, seed) };
}

/**
 * The broken rock edge the slope's head is tucked under: the higher ground's rim, a horseshoe from
 * one flank round the crest to the other, its outer edge jagged as broken rock.
 */
function lipOf(head: readonly Vec[], frame: WayFrame, seed: number): Vec[] {
  const centre = head.reduce((s, p) => ({ x: s.x + p.x / head.length, y: s.y + p.y / head.length }), { x: 0, y: 0 });
  const end = frame.at(0, -frame.along / 2 + 0.02);
  // Out from the slope, never past the stairwell's end.
  const back = head.map((p, i) => {
    const dx = p.x - centre.x;
    const dy = p.y - centre.y;
    const len = Math.hypot(dx, dy) || 1;
    // Thinner at its two ends, where it runs out along the flanks.
    const k = Math.min(1, i, head.length - 1 - i) * 0.5 + 0.5;
    const depth = LIP * k * (0.55 + 0.45 * valueNoise(i * 2.3, 7, seed)) + 0.02 * (valueNoise(i * 7.1, 3, seed) - 0.5);
    return { x: p.x + dx / len * depth, y: p.y + dy / len * depth };
  });
  const { down } = frame;
  const kept = back.map(p => {
    const over = (p.x - end.x) * down.x + (p.y - end.y) * down.y;
    return over < 0 ? { x: p.x - down.x * over, y: p.y - down.y * over } : p;
  });
  return chiselled([...head, ...kept.reverse()], seed + 3, 0.025);
}

/** A flank broken where loose stone frays its edge, and fading out before the toe. */
function frayed(run: readonly Vec[], seed: number): Vec[][] {
  const out: Vec[][] = [];
  let piece: Vec[] = [];
  const keep = Math.round(run.length * 0.85);
  run.slice(0, keep).forEach((p, i) => {
    if (valueNoise(i * 1.7, 13, seed) > 0.62 && piece.length > 1) {
      out.push(piece);
      piece = [];
    } else piece.push(p);
  });
  if (piece.length > 1) out.push(piece);
  return out;
}

/**
 * Stones sorted down the slope: a few small ones scattered on its middle, boulders gathered in
 * clumps at its foot, each a large stone with smaller ones against it, and a few spilled past the toe.
 */
function stonesOf(frame: WayFrame, width: (t: number) => number, vAt: (t: number) => number, seed: number): Stone[] {
  const { at, along, across } = frame;
  const rng = rngFrom(seed);
  const stones: Stone[] = [];
  const add = (u: number, t: number, r: number): void => {
    const c = at(u, vAt(t));
    stones.push({ poly: stoneOutline(rng, c, r), c, r });
  };
  const scale = Math.min(1, across / 2);
  const scattered = Math.max(3, Math.round(along * 1.6));
  for (let i = 0; i < scattered; i++) {
    const t = 0.3 + 0.38 * rng();
    add((rng() * 2 - 1) * (width(t) - 0.06), t, (0.026 + 0.022 * rng()) * (0.8 + 0.4 * t));
  }
  const clumps = Math.max(2, Math.round(across * 1.6));
  for (let k = 0; k < clumps; k++) {
    const t = toeAt(along) + 0.04 + 0.14 * rng();
    const u = ((k + 0.5) / clumps * 2 - 1) * (width(t) * 0.78 - 0.1) + (rng() - 0.5) * 0.08;
    const big = (0.07 + 0.035 * rng()) * scale;
    add(u, t, big);
    for (let j = 0; j < 2; j++) {
      const a = rng() * Math.PI * 2;
      const r = big * (0.4 + 0.25 * rng());
      add(u + Math.cos(a) * (big + r) * 0.85, t + Math.sin(a) * (big + r) * 0.85 / along, r);
    }
  }
  // Spilled past the toe, still inside the stairwell.
  for (let i = 0; i < 3; i++) add((rng() * 2 - 1) * (width(toeAt(along)) - 0.15), 0.88 + 0.08 * rng(), 0.018 + 0.018 * rng());
  return stones;
}
