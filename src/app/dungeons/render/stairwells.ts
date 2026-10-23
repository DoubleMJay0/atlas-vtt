import type { DungeonStair } from '../model';
import { strokeWidth, type RenderEnv } from './renderEnv';

/** Treads per cell along the way down. */
const TREADS_PER_CELL = 3;
/** How much of its width the lowest tread keeps. */
const LOW_TREAD = 0.55;

/**
 * The floor's stairwells: the rectangle inked, treads across it that shorten towards the low end
 * (`down`), as the steps between rooms are drawn. Both ends of a stairwell look alike.
 */
export function drawStairwells(env: RenderEnv): void {
  for (const stair of env.dungeon.floor.stairs) drawStairwell(env, stair);
}

function drawStairwell(env: RenderEnv, stair: DungeonStair): void {
  const { ctx, palette, style } = env;
  const along = stair.down.x !== 0 ? stair.w : stair.h;
  const across = stair.down.x !== 0 ? stair.h : stair.w;
  ctx.save();
  ctx.translate(stair.x + stair.w / 2, stair.y + stair.h / 2);
  // u across the treads, v along the way down
  ctx.transform(-stair.down.y, stair.down.x, stair.down.x, stair.down.y, 0, 0);
  ctx.fillStyle = palette.floor;
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.lineWidth = strokeWidth(env, style.strokes.normal);
  ctx.beginPath();
  ctx.rect(-across / 2, -along / 2, across, along);
  ctx.fill();
  ctx.stroke();
  const treads = along * TREADS_PER_CELL;
  ctx.beginPath();
  for (let i = 1; i < treads; i++) {
    const t = i / treads;
    const half = (across / 2) * (1 - (1 - LOW_TREAD) * t);
    const v = -along / 2 + along * t;
    ctx.moveTo(-half, v);
    ctx.lineTo(half, v);
  }
  ctx.lineWidth = strokeWidth(env, style.strokes.thin);
  ctx.stroke();
  ctx.restore();
}
