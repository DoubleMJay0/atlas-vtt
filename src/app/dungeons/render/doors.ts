import type { DungeonDoor } from '../model';
import { wallWidth } from './floors';
import { strokeWidth, type RenderEnv } from './renderEnv';

/**
 * Doors, drawn in the door cell's own frame: u across the opening, v along the passage from the
 * parent room towards the child, both from −0.5 to 0.5.
 */
export function drawDoors(env: RenderEnv): void {
  for (const door of env.dungeon.doors) {
    const { ctx } = env;
    ctx.save();
    ctx.translate(door.x + 0.5, door.y + 0.5);
    ctx.transform(-door.dir.y, door.dir.x, door.dir.x, door.dir.y, 0, 0);
    drawDoor(env, door);
    ctx.restore();
  }
}

function drawDoor(env: RenderEnv, door: DungeonDoor): void {
  const { ctx } = env;
  switch (door.kind) {
    case 'door':
      leaf(env, 0);
      return;
    case 'gate':
      leaf(env, 0);
      line(env, 0, -0.42, 0, 0.42);
      return;
    case 'barricade':
      leaf(env, 0.2);
      line(env, -0.42, -0.22, 0.42, -0.22);
      return;
    case 'doorway': {
      const w = wallWidth(env);
      ctx.fillStyle = env.palette.ink;
      ctx.fillRect(-0.5 - w, -0.25, 0.2 + w, 0.5);
      ctx.fillRect(0.3, -0.25, 0.2 + w, 0.5);
      return;
    }
    case 'portcullis': {
      ctx.fillStyle = env.palette.ink;
      ctx.beginPath();
      for (const u of [-0.3, 0, 0.3]) {
        ctx.moveTo(u + wallWidth(env), 0);
        ctx.arc(u, 0, wallWidth(env), 0, Math.PI * 2);
      }
      ctx.fill();
      return;
    }
    case 'entrance':
      exit(env, -1);
      stairs(env, 1, 1);
      return;
    case 'stairs-down':
      exit(env, 1);
      stairs(env, -1, 1);
      return;
    case 'steps':
      stairs(env, -1, 0.8);
      return;
    default:
      return;
  }
}

/** The door leaf: a short bar across the opening, filled with floor, inked at wall width. */
function leaf(env: RenderEnv, v: number): void {
  const { ctx, palette } = env;
  const halfWidth = (18 / 2 + 1.75) * env.px;
  const halfDepth = 3.75 * env.px;
  ctx.beginPath();
  ctx.rect(-halfWidth, v - halfDepth, halfWidth * 2, halfDepth * 2);
  ctx.fillStyle = palette.floor;
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = 'round';
  ctx.lineWidth = wallWidth(env);
  ctx.stroke();
}

function line(env: RenderEnv, u0: number, v0: number, u1: number, v1: number): void {
  const { ctx } = env;
  ctx.beginPath();
  ctx.moveTo(u0, v0);
  ctx.lineTo(u1, v1);
  ctx.strokeStyle = env.palette.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = strokeWidth(env, env.style.strokes.normal);
  ctx.stroke();
}

/**
 * Five treads 6 px apart, narrowing away from the room they serve: `wide` is the side (−1 or
 * 1 along v) of the widest tread.
 */
function stairs(env: RenderEnv, wide: -1 | 1, scale: number): void {
  const { ctx } = env;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const v = wide * (2 - i) * 6 * scale * env.px;
    const half = (15 - i * 3 * scale) * env.px;
    ctx.moveTo(-half, v);
    ctx.lineTo(half, v);
  }
  ctx.strokeStyle = env.palette.ink;
  ctx.lineCap = 'butt';
  ctx.lineWidth = strokeWidth(env, env.style.strokes.normal);
  ctx.stroke();
}

/** With Exits on, clear ground outside a way in or out: a square of paper over the hatching. */
function exit(env: RenderEnv, side: -1 | 1): void {
  if (!env.view.exits) return;
  env.ctx.fillStyle = env.palette.paper;
  env.ctx.fillRect(-0.5, side > 0 ? 0.5 : -1.5, 1, 1);
}
