import { shapePolygon, traceShapes, tracePolygon } from './geometry';
import { unionRings } from './clipShapes';
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
 * The inner shadow: the walls cast a soft shadow onto the floor, falling towards the bottom right
 * of the screen whatever the map's turn, and every standing column casts one beside it. Drawn as
 * the blurred shadow of everything that is not floor, multiplied onto the floor and clipped to it.
 */
export function drawInnerShadow(env: RenderEnv): void {
  const { ctx, palette, dungeon } = env;
  if (!palette.shadow) return;
  const { a, b, c, d } = ctx.getTransform();
  // Shadow offset and blur are in device pixels, outside the context's transform.
  const devicePerCell = Math.sqrt(Math.abs(a * d - b * c));
  const distance = env.style.shadow.distance * devicePerCell;
  const bounds = dungeon.bounds;
  const solid = unionRings(dungeon.floors.map(shape => shapePolygon(shape, 0, env.pxPerCell)));
  ctx.save();
  clipToFloors(env);
  ctx.globalCompositeOperation = 'multiply';
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = distance * 1.2;
  ctx.shadowOffsetX = distance * 0.75;
  ctx.shadowOffsetY = distance * 0.75;
  ctx.fillStyle = palette.shadow;
  ctx.beginPath();
  ctx.rect(bounds.minX - 4, bounds.minY - 4, bounds.maxX - bounds.minX + 8, bounds.maxY - bounds.minY + 8);
  for (const ring of solid) tracePolygon(ctx, ring);
  ctx.fill('evenodd');
  ctx.beginPath();
  for (const column of dungeon.model.columns) {
    if (column.shattered || dungeon.field.distance(column.x, column.y) >= 0) continue;
    const r = column.radius;
    if (column.square) {
      ctx.rect(column.x - r, column.y - r, r * 2, r * 2);
      continue;
    }
    ctx.moveTo(column.x + r, column.y);
    ctx.arc(column.x, column.y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}
