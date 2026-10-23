import type { DungeonProp } from '../model';
import { drawPropShape, propLift, tracePropSilhouette } from './propShapes';
import { glyphWeights } from './glyphPen';
import type { RenderEnv } from './renderEnv';

/** Props of the rooms on show, each at its place, turn and scale. */
export function drawProps(env: RenderEnv): void {
  if (!env.view.props) return;
  const { dungeon } = env;
  drawPropList(env, dungeon.floor.props.filter(prop => dungeon.roomShapes.has(prop.room)));
}

/** The props given: first the shadows they cast, then the props over them. */
export function drawPropList(env: RenderEnv, props: readonly DungeonProp[]): void {
  castShadows(env, props);
  for (const prop of props) drawProp(env, prop);
}

function moveTo(env: RenderEnv, prop: DungeonProp): void {
  env.ctx.translate(prop.x, prop.y);
  env.ctx.rotate(prop.rotation);
  env.ctx.scale(prop.scale, prop.scale);
}

function drawProp(env: RenderEnv, prop: DungeonProp): void {
  const { ctx, palette } = env;
  ctx.save();
  moveTo(env, prop);
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const { outline, fine } = glyphWeights(env);
  ctx.lineWidth = outline / prop.scale;
  drawPropShape(prop.kind, { ctx, palette, fine: fine / prop.scale });
  ctx.restore();
}

/**
 * What stands casts a soft shadow towards the bottom right of the screen, as walls and columns do,
 * longer the taller it stands. Drawn as the shadow of its silhouette, which the prop then covers.
 */
function castShadows(env: RenderEnv, props: readonly DungeonProp[]): void {
  const { ctx, palette } = env;
  if (!palette.shadow) return;
  const { a, b, c, d } = ctx.getTransform();
  // Shadow offset and blur are in device pixels, outside the context's transform.
  const devicePerCell = Math.sqrt(Math.abs(a * d - b * c));
  for (const prop of props) {
    const distance = env.style.shadow.distance * propLift(prop.kind) * prop.scale * devicePerCell;
    if (distance <= 0) continue;
    ctx.save();
    moveTo(env, prop);
    ctx.beginPath();
    if (tracePropSilhouette(prop.kind, ctx)) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.shadowColor = palette.shadow;
      ctx.shadowBlur = distance * 1.2;
      ctx.shadowOffsetX = distance * 0.75;
      ctx.shadowOffsetY = distance * 0.75;
      ctx.fillStyle = palette.shadow;
      ctx.fill();
    }
    ctx.restore();
  }
}
