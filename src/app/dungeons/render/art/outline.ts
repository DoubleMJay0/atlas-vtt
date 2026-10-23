import { unionRings } from '../clipShapes';
import { shapePolygon, type Vec } from '../geometry';
import type { ArtScene } from './artScene';
import { mouthClearing, mouthsOf } from './mouths';
import { polyPath, type PathFn } from './paths';

/** Rings of the union of the floors grown by `grow` cells (rectangles keep square corners). */
export function grownRings(scene: ArtScene, grow: number): Vec[][] {
  return unionRings(scene.floors.map(shape => shapePolygon(shape, grow, scene.frame.pxPerCell)));
}

export function traceRings(path: CanvasPath, rings: readonly (readonly Vec[])[]): void {
  for (const ring of rings) polyPath(ring)(path);
}

/** Clips to everything but the ground just beyond each way in, where no wall stands. */
export function clipOutsideMouths(scene: ArtScene, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D = scene.env.ctx): void {
  const mouths = mouthsOf(scene.env.dungeon);
  if (mouths.length === 0) return;
  const g = scene.grid;
  ctx.beginPath();
  ctx.rect(g.x0, g.y0, g.w / g.res, g.h / g.res);
  for (const mouth of mouths) polyPath(mouthClearing(mouth))(ctx);
  ctx.clip('evenodd');
}

/** Whether the rock lies to the left of a ring's edge from `a` to `b`; the way into the rock. */
export function rockSide(scene: ArtScene, a: Vec, b: Vec): Vec {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  const mx = (a.x + b.x) / 2 + n.x * 0.02;
  const my = (a.y + b.y) / 2 + n.y * 0.02;
  return scene.env.dungeon.field.distance(mx, my) > 0 ? n : { x: -n.x, y: -n.y };
}

/** Clips to the floors. */
export function clipFloors(scene: ArtScene, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D = scene.env.ctx): void {
  ctx.beginPath();
  traceRings(ctx, scene.floorRings);
  ctx.clip();
}

export type { PathFn };
