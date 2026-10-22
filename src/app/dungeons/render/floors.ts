import { shapePolygon, traceShapes, tracePolygon } from './geometry';
import { shadowRegion } from './clipShapes';
import { strokeWidth, type RenderEnv } from './renderEnv';
import { withAlpha } from './palette';

/** The wall's visible width outside the floor, in cells; Stonework walls use the normal stroke. */
export function wallWidth(env: RenderEnv): number {
  const { strokes, hatching } = env.style;
  return strokeWidth(env, hatching.mode === 'stonework' ? strokes.normal : strokes.thick);
}

/**
 * The soft band of shading colour around the walls: every floor grown by the hatching distance,
 * with round corners, its edge feathered.
 */
export function drawShadingBand(env: RenderEnv): void {
  const { ctx, palette, dungeon } = env;
  const d = env.style.hatching.distance;
  ctx.save();
  ctx.fillStyle = palette.shading;
  ctx.beginPath();
  traceShapes(ctx, dungeon.floors, d, d);
  ctx.fill();
  ctx.strokeStyle = withAlpha(palette.shading, 0.4);
  ctx.lineWidth = strokeWidth(env, env.style.strokes.thick);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/**
 * Walls and floor: every floor shape stroked in ink at twice the wall width, then filled, so the
 * wall shows only outside the union of the floors, with round joins.
 */
export function drawWallsAndFloor(env: RenderEnv): void {
  const { ctx, palette, dungeon } = env;
  ctx.save();
  ctx.beginPath();
  traceShapes(ctx, dungeon.floors);
  ctx.lineJoin = 'round';
  ctx.lineWidth = wallWidth(env) * 2;
  ctx.strokeStyle = palette.ink;
  ctx.stroke();
  ctx.fillStyle = palette.floor;
  ctx.fill();
  ctx.restore();
}

/** Restricts drawing to the floors, until the caller restores the context. */
export function clipToFloors(env: RenderEnv): void {
  const { ctx, dungeon } = env;
  ctx.beginPath();
  traceShapes(ctx, dungeon.floors);
  ctx.clip();
}

/**
 * The inner shadow: the strip of floor the floor shifted towards the light leaves uncovered,
 * and a disc beside every column, multiplied onto the floor.
 */
export function drawInnerShadow(env: RenderEnv): void {
  const { ctx, palette, dungeon, shadowOffset } = env;
  if (!palette.shadow) return;
  const floors = dungeon.floors.map(shape => shapePolygon(shape, 0, env.pxPerCell));
  const rim = wallWidth(env);
  const columns = dungeon.model.columns
    .filter(c => dungeon.field.distance(c.x, c.y) < 0)
    .map(c => shapePolygon({ kind: 'circle', cx: c.x + shadowOffset.x, cy: c.y + shadowOffset.y, r: c.radius + rim * 0.5 }, 0, env.pxPerCell));
  const region = shadowRegion(floors, shadowOffset, columns);
  ctx.save();
  clipToFloors(env);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = palette.shadow;
  ctx.beginPath();
  for (const ring of region) tracePolygon(ctx, ring);
  ctx.fill();
  ctx.restore();
}
