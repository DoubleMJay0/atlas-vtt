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

/** An opening needs nothing here (a narrow one's jambs are wall, cut out of the door cell's floor), nor a secret door, which is wall. */
function drawDoor(env: RenderEnv, door: DungeonDoor): void {
  if (door.from === null && door.kind !== 'secret') exit(env, -1);
  switch (door.kind) {
    case 'door':
      leaf(env, 0);
      return;
    case 'steps':
      stairs(env, door.descends ? -1 : 1, 0.8);
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

/**
 * Five treads 6 px apart, narrowing towards the low end: `wide` is the side (−1 or 1 along v) of
 * the widest, highest tread.
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

/** With Exits on, clear ground outside a way in: a square of paper over the hatching. */
function exit(env: RenderEnv, side: -1 | 1): void {
  if (!env.view.exits) return;
  env.ctx.fillStyle = env.palette.paper;
  env.ctx.fillRect(-0.5, side > 0 ? 0.5 : -1.5, 1, 1);
}
