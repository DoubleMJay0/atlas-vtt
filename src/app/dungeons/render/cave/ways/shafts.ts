import { stackOf, stairEnd } from '../../../floors/floorStack';
import type { StairEnd } from '../../../floors/stairSpots';
import type { DungeonStair } from '../../../model';
import type { Hand } from '../../art/hand';
import { polyPath } from '../../art/paths';
import { pointsBounds, type Vec } from '../../geometry';
import { wayFrame, type WayFrame } from './narrows';

/** Broken rock shoulders mark the well's sides, leaving its ground end open. */
export function shaftSides(hand: Hand, frame: WayFrame, end: StairEnd): void {
  const { at, across, along } = frame;
  const u = across / 2;
  const v = along / 2;
  const far = end === 'upper' ? v : -v;
  const sign = end === 'upper' ? 1 : -1;
  const sides = [-1, 1].flatMap(side => [
    [at(side * (u - 0.08), -far + sign * 0.12), at(side * u, -far * 0.55), at(side * (u - 0.06), -sign * 0.12)],
    [at(side * (u - 0.05), sign * 0.14), at(side * (u - 0.025), far * 0.65), at(side * (u - 0.16), far - sign * 0.05)],
  ]);
  hand.line(sides, 'outline');
  hand.line([-1, 1].map(side => [at(side * (u - 0.16), far - sign * 0.05), at(side * u * 0.70, far - sign * 0.13), at(side * u * 0.40, far - sign * 0.09)]), 'fine');
}

/** Broken shoulders, with their corners pulled off the rectangular placement envelope. */
function throat(frame: WayFrame, end: StairEnd): Vec[] {
  const { at, across, along } = frame;
  const u = Math.min(0.42, across / 2 - 0.10);
  const v = Math.min(0.42, along / 2 - 0.10);
  const centre = (end === 'upper' ? 1 : -1) * (along / 2 - v - 0.12);
  return [[-0.65, -1], [0.40, -0.98], [0.91, -0.77], [1, -0.22], [0.84, 0.13], [0.97, 0.68], [0.49, 0.98], [-0.31, 1], [-0.87, 0.79], [-1, 0.34], [-0.90, -0.28], [-0.97, -0.73]].map(([x, y]) => at(x! * u, centre + y! * v));
}

/** A laid rope as a narrow ribbon: its fill and diagonal fibre are the painter's own. */
function rope(hand: Hand, run: Vec[]): void {
  const half = 0.018;
  const sides = [-1, 1].map(side => run.map((p, i) => {
    const a = run[Math.max(0, i - 1)]!;
    const b = run[Math.min(run.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x - (b.y - a.y) / len * half * side, y: p.y + (b.x - a.x) / len * half * side };
  }));
  const band = [...sides[0]!, ...sides[1]!.slice().reverse()];
  hand.surface(polyPath(band), 'rope');
  hand.line(sides, 'fine');
  const strands: Vec[][] = [];
  let next = 0.04;
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1]!;
    const b = run[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const tx = (b.x - a.x) / length;
    const ty = (b.y - a.y) / length;
    for (; next < length; next += 0.08) {
      const x = a.x + tx * next;
      const y = a.y + ty * next;
      strands.push([-1, 1].map(side => ({ x: x + side * (tx * 0.012 - ty * half * 0.7), y: y + side * (ty * 0.012 + tx * half * 0.7) })));
    }
    next -= length;
  }
  hand.line(strands, 'fine');
}

function shaft(hand: Hand, stair: DungeonStair, end: StairEnd): void {
  const frame = wayFrame(stair, stair.down);
  const { at, along, across } = frame;
  const rim = throat(frame, end);
  const top = -along / 2;
  if (end === 'upper') {
    hand.surface(polyPath(rim), 'rock');
    const bounds = pointsBounds(rim);
    const mouth = wayFrame({ x: bounds.minX, y: bounds.minY, w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY }, stair.down);
    // This one-dimensional depth needs no sampled field or compositing layer in Stone.
    // The direct gradient keeps the rope shaft inside the family's drawing-time budget.
    const { ctx, style } = hand.scene.env;
    if (style.direction === 'stone' && hand.scene.raster) {
      const a = mouth.at(0, -mouth.along / 2);
      const b = mouth.at(0, mouth.along / 2);
      const depth = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      depth.addColorStop(0, 'rgba(0,0,0,0.14)');
      depth.addColorStop(0.5, 'rgba(0,0,0,0.62)');
      depth.addColorStop(1, 'rgba(0,0,0,0.97)');
      ctx.save();
      ctx.beginPath();
      polyPath(rim)(ctx);
      ctx.fillStyle = depth;
      ctx.fill();
      ctx.restore();
    } else hand.tone((x, y) => 0.14 + 0.83 * mouth.progress(x, y) ** 0.8, bounds, polyPath(rim), 'depth');
    hand.edges(rim, false);
    const lip = along / 2 - 1.10;
    hand.line([[at(-0.34, lip + 0.19), at(-0.26, lip + 0.36), at(-0.29, lip + 0.48)], [at(0.31, lip + 0.30), at(0.23, lip + 0.46)]], 'fine');
    const anchor = [at(-0.20, lip - 0.27), at(0.10, lip - 0.24), at(0.18, lip - 0.08), at(-0.03, lip + 0.01), at(-0.23, lip - 0.10)];
    hand.surface(polyPath(anchor), 'rock');
    hand.edges(anchor, true);
    rope(hand, [at(-0.18, lip - 0.17), at(-0.11, lip - 0.05), at(0.09, lip - 0.07), at(0.10, lip - 0.19), at(-0.11, lip - 0.20), at(-0.07, lip + 0.08), at(0.02, lip + 0.40), at(0.05, lip + 0.70)]);
  } else {
    const cut = top + along * 0.38;
    const u = across / 2 - 0.10;
    hand.line([[at(-u, cut + 0.05), at(-0.17, cut + 0.02), at(-0.06, cut - 0.08), at(0.04, cut + 0.11), at(0.16, cut - 0.02), at(u, cut - 0.04)]], 'outline');
    // Only short broken contours mark the ceiling: the floor beneath remains visible.
    hand.line([[rim[10]!, rim[11]!, rim[0]!], [rim[1]!, rim[2]!, rim[3]!]], 'fine');
    const coil = along / 2 - 0.40;
    const run = [at(0.03, cut - 0.12), at(0.01, cut + 0.22), at(-0.06, coil - 0.34)];
    for (let k = 0; k <= 42; k++) {
      const t = k / 42;
      const a = -Math.PI / 2 + t * Math.PI * 4.5;
      const r = 0.24 - t * 0.17;
      run.push(at(Math.cos(a) * r, coil + Math.sin(a) * r * 0.65));
    }
    rope(hand, run);
  }
  shaftSides(hand, frame, end);
}

function drawEnds(hand: Hand, end: StairEnd): void {
  const { dungeon } = hand.scene.env;
  for (const stair of dungeon.floor.stairs) {
    if (stair.way === 'pitch' && stairEnd(stackOf(dungeon.model), dungeon.index, stair.to) === end) shaft(hand, stair, end);
  }
}

export function drawPitches(hand: Hand): void { drawEnds(hand, 'upper'); }
export function drawAvens(hand: Hand): void { drawEnds(hand, 'lower'); }
