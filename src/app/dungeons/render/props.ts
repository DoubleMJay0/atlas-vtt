import { drawPropShape } from './propShapes';
import { strokeWidth, type RenderEnv } from './renderEnv';

/** Props of the rooms on show, each at its place, turn and scale. */
export function drawProps(env: RenderEnv): void {
  const { ctx, dungeon, palette, style } = env;
  if (!env.view.props) return;
  const fine = strokeWidth(env, (style.strokes.normal + style.strokes.thin) / 2);
  for (const prop of dungeon.model.props) {
    if (!dungeon.roomShapes.has(prop.room)) continue;
    ctx.save();
    ctx.translate(prop.x, prop.y);
    ctx.rotate(prop.rotation);
    ctx.scale(prop.scale, prop.scale);
    ctx.strokeStyle = palette.ink;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = strokeWidth(env, style.strokes.normal) / prop.scale;
    drawPropShape(prop.kind, { ctx, palette, fine: fine / prop.scale });
    ctx.restore();
  }
}
