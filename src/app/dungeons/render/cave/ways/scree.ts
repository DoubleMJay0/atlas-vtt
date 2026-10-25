import { stackOf, stairEnd } from '../../../floors/floorStack';
import type { StairEnd } from '../../../floors/stairSpots';
import type { CellDir } from '../../../model';
import { rngFrom } from '../../../rng';
import type { Hand } from '../../art/hand';
import { hash2, valueNoise } from '../../art/noise';
import { polyPath, polysPath } from '../../art/paths';
import type { Vec } from '../../geometry';
import { stoneOutline } from '../../terrain/stones';
import { doorFrame, wayFrame, type WayFrame } from './narrows';
import { dashes } from './shaftMouth';
import { layGrit } from './screeGrit';
import { layRubbleShadow, laySlopeTone } from './slopeShading';

/**
 * A scree slope: a fan of loose stone that widens towards its foot. Spur lines fall from its crest
 * as a surveyor draws a steep slope, the stones grow and gather towards the toe, and the slope
 * darkens into the floor below where it goes down from this floor (`upper`). Where it comes up to
 * this floor (`lower`) its crest is overhead, dashed, in the ceiling's shadow. Steps between rooms
 * of one floor (no end) show it whole.
 */

interface Fan {
  outline: Vec[];
  crest: Vec[];
  /** Half the fan's width at `t` (0 its crest, 1 its toe). */
  width: (t: number) => number;
  top: number;
  foot: number;
}

function fanOf(frame: WayFrame, seed: number): Fan {
  const { at, along, across } = frame;
  const top = -along / 2 + Math.min(0.12, along * 0.08);
  const foot = along / 2 - 0.06;
  const narrow = (across / 2 - 0.12) * 0.62;
  const wide = across / 2 - 0.07;
  const width = (t: number): number => narrow + (wide - narrow) * Math.sqrt(t);
  const vAt = (t: number): number => top + (foot - top) * t;
  const n = 12;
  const crest: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n * 2 - 1;
    crest.push(at(s * narrow, top + 0.05 * (1 - s * s) + 0.024 * (valueNoise(i * 1.3, 0, seed) - 0.5)));
  }
  const side = (sign: number): Vec[] => Array.from({ length: n - 1 }, (_, i) => {
    const t = (i + 1) / n;
    return at(sign * (width(t) + 0.035 * (valueNoise(t * 7, sign * 3, seed) - 0.5)), vAt(t));
  });
  const toe: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const s = 1 - i / n * 2;
    const lobe = 0.035 * Math.cos(s * Math.PI * 1.5) + 0.025 * (valueNoise(i * 2.1, 9, seed) - 0.5);
    toe.push(at(s * wide, foot - 0.04 + lobe));
  }
  const outline = [...crest, ...side(1), ...toe, ...side(-1).reverse()];
  return { outline, crest, width, top, foot };
}

/** Stones lined up in loose runs down the fall line, small at the crest and heavier towards the toe, where they gather. */
function stonesOf(frame: WayFrame, fan: Fan, seed: number): { poly: Vec[]; c: Vec; r: number }[] {
  const { at, along } = frame;
  const rng = rngFrom(seed);
  const stones: { poly: Vec[]; c: Vec; r: number }[] = [];
  const rows = Math.max(3, Math.ceil(along * 1.7));
  for (let row = 0; row < rows; row++) {
    const t = 0.25 + 0.75 * (row + 0.25 + rng() * 0.5) / rows;
    const half = fan.width(t);
    const columns = Math.max(2, Math.round(half * 2.8));
    for (let col = 0; col < columns; col++) {
      const r = 0.03 + 0.08 * t ** 1.8 + rng() * 0.024;
      const u = ((col + 0.2 + rng() * 0.6) / columns * 2 - 1) * Math.max(0, half - r - 0.02);
      const c = at(u, fan.top + (fan.foot - fan.top - 0.04) * t);
      stones.push({ poly: stoneOutline(rng, c, r), c, r });
    }
  }
  return stones;
}

/** How far the longest spur line runs down a slope, in cells. */
function spurReach(along: number): number {
  return Math.min(0.42, along * 0.17);
}

/** Spur lines from the crest down the fall line, long and short in turn: close-set and long, as a steep slope is drawn. */
function spurs(frame: WayFrame, fan: Fan, seed: number): Vec[][] {
  const { at, along } = frame;
  const out: Vec[][] = [];
  const reach = spurReach(along);
  const count = Math.max(4, Math.round(fan.width(0) * 2 / 0.08));
  for (let i = 0; i <= count; i++) {
    const jitter = (valueNoise(i * 2.9, 5, seed) - 0.5) * 0.6;
    const s = Math.max(-1, Math.min(1, (i + jitter) / count * 2 - 1));
    const u = s * (fan.width(0) - 0.03);
    const start = fan.top + 0.05 * (1 - s * s) + 0.01 + 0.03 * valueNoise(i * 1.1, 8, seed);
    // Long and short in no fixed turn, as a hand draws them; the long ones carry nearly to the slope's middle.
    const length = reach * (0.35 + 0.75 * valueNoise(i * 1.7, 3, seed) ** 1.4);
    const splay = s * 0.18 * length;
    const bend = (valueNoise(i * 3.7, 1, seed) - 0.5) * 0.04;
    out.push([at(u, start), at(u + splay * 0.45 + bend, start + length * 0.5), at(u + splay, start + length)]);
  }
  return out;
}

function slope(hand: Hand, frame: WayFrame, end?: StairEnd): void {
  const seed = Math.floor(hash2(frame.bounds.minX, frame.bounds.minY, hand.scene.env.dungeon.model.seed) * 0x7fffffff);
  const fan = fanOf(frame, seed);
  const path = polyPath(fan.outline);
  laySlopeTone(hand, frame, path, end);
  const lines = spurs(frame, fan, seed);
  const reach = spurReach(frame.along);
  const long = (run: Vec[]): boolean => Math.hypot(run[2]!.x - run[0]!.x, run[2]!.y - run[0]!.y) > reach * 0.7;
  hand.line(lines.filter(long), 'outline');
  hand.line(lines.filter(run => !long(run)), 'fine');
  layGrit(hand, frame, path, 0.14, 0.5);
  const stones = stonesOf(frame, fan, seed);
  layRubbleShadow(hand, stones.map(s => s.poly), 0.025);
  hand.fill(polysPath(stones.map(s => s.poly)), 'rock');
  // Only the heaviest stones at the toe are modelled; the rest read by their outline.
  for (const s of stones.slice().sort((a, b) => b.r - a.r).slice(0, 2)) hand.solid(polyPath(s.poly), s.c, s.r, frame.progress(s.c.x, s.c.y));
  hand.line(stones.filter(s => s.r <= 0.07).map(s => s.poly), 'fine', true);
  hand.line(stones.filter(s => s.r > 0.07).map(s => s.poly), 'outline', true);
  // The fan's flanks are loose stone, drawn fine; its crest is where the floor breaks over, or the ceiling it comes down from.
  const flanks = [...fan.outline.slice(fan.crest.length - 1), fan.outline[0]!];
  hand.line([flanks], 'fine');
  if (end === 'lower') hand.line(dashes(fan.crest, 0.1, 0.06), 'outline');
  else hand.line([fan.crest], 'outline');
}

export function drawScree(hand: Hand): void {
  const { dungeon } = hand.scene.env;
  for (const door of dungeon.doors) {
    if (door.kind !== 'steps') continue;
    const down = door.descends ? door.dir : { x: -door.dir.x, y: -door.dir.y } as CellDir;
    slope(hand, doorFrame(door, down));
  }
  for (const stair of dungeon.floor.stairs) {
    if (stair.way === 'scree') slope(hand, wayFrame(stair, stair.down), stairEnd(stackOf(dungeon.model), dungeon.index, stair.to));
  }
}
