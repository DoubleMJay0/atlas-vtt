import { traceShapes } from './geometry';
import type { RenderEnv } from './renderEnv';

/** Restricts drawing to the floors, until the caller restores the context. */
export function clipToFloors(env: RenderEnv): void {
  const { ctx, dungeon } = env;
  ctx.beginPath();
  traceShapes(ctx, dungeon.floors);
  ctx.clip();
}
