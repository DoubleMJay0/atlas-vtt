import { shuffled } from '../rng';
import type { FloorShape, Vec } from './geometry';
import { strokeWidth, type RenderEnv } from './renderEnv';
import { edgePlaces } from './shapeEdges';

/**
 * Masonry along the walls: one course of blocks of uneven length and depth laid outward from
 * every floor edge, drawn in shuffled order so they overlap like stones set by hand.
 */
export function drawStonework(env: RenderEnv): void {
  const { ctx, palette, style, dungeon } = env;
  const rng = env.rng('stonework');
  const size = Math.max(style.hatching.size, 0.1);
  const depth = style.hatching.distance;
  const blocks: Vec[][] = [];
  for (const shape of dungeon.outlines) {
    for (const place of edgePlaces(shape, 0, size * 0.9, rng() * size)) {
      const length = size * (0.8 + rng() * 0.5);
      const thick = depth * (0.2 + rng() * 0.4);
      blocks.push(block(place.point, place.tangent, place.normal, -0.04, thick, length, (rng() - 0.5) * 0.06, rng));
    }
    if (shape.kind === 'rect') blocks.push(...cornerBlocks(shape, depth, rng));
  }
  ctx.save();
  ctx.fillStyle = palette.shading;
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = 'round';
  ctx.lineWidth = strokeWidth(env, style.strokes.normal);
  for (const corners of shuffled(rng, blocks)) {
    ctx.beginPath();
    ctx.moveTo(corners[0]!.x, corners[0]!.y);
    for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** A slightly skewed block from `start` (along the normal) to `start + thick`, centred on `p`. */
function block(p: Vec, tangent: Vec, normal: Vec, start: number, thick: number, length: number, turn: number, rng: () => number): Vec[] {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const t = { x: tangent.x * c - tangent.y * s, y: tangent.x * s + tangent.y * c };
  const n = { x: normal.x * c - normal.y * s, y: normal.x * s + normal.y * c };
  const half = length / 2;
  const jitter = (): number => (rng() - 0.5) * length * 0.06;
  const at = (u: number, v: number): Vec => ({ x: p.x + t.x * u + n.x * v, y: p.y + t.y * u + n.y * v });
  return [at(-half + jitter(), start), at(half + jitter(), start), at(half + jitter(), start + thick), at(-half + jitter(), start + thick)];
}

/** A square stone on every outer corner of a rectangle, so the courses meet. */
function cornerBlocks(r: Extract<FloorShape, { kind: 'rect' }>, depth: number, rng: () => number): Vec[][] {
  const corners: [number, number, number, number][] = [
    [r.x, r.y, -1, -1],
    [r.x + r.w, r.y, 1, -1],
    [r.x + r.w, r.y + r.h, 1, 1],
    [r.x, r.y + r.h, -1, 1],
  ];
  return corners.map(([x, y, sx, sy]) => {
    const a = depth * (0.3 + rng() * 0.3);
    const b = -0.04;
    return [
      { x: x - sx * -b, y: y - sy * -b },
      { x: x + sx * a, y: y - sy * -b },
      { x: x + sx * a, y: y + sy * a },
      { x: x - sx * -b, y: y + sy * a },
    ];
  });
}
