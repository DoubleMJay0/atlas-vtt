import type { DungeonColumn } from '../model';
import { strokeWidth, type RenderEnv } from './renderEnv';

/**
 * Columns: filled with the shading colour, inked round, hatched inside when the dungeon is
 * hatched. A shattered column is its outline alone. Their shadows come with the inner shadow.
 */
export function drawColumns(env: RenderEnv): void {
  const { ctx, palette, style, dungeon } = env;
  const columns = dungeon.model.columns.filter(c => dungeon.field.distance(c.x, c.y) < 0);
  if (!columns.length) return;
  const outline = strokeWidth(env, style.strokes.normal);
  const hatched = style.hatching.mode === 'hatching';
  for (const column of columns) {
    ctx.save();
    traceColumn(ctx, column);
    ctx.strokeStyle = palette.ink;
    ctx.lineJoin = 'round';
    if (column.shattered) {
      ctx.lineWidth = strokeWidth(env, style.strokes.thin) * 1.5;
      ctx.setLineDash([column.radius * 0.5, column.radius * 0.25]);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    ctx.fillStyle = palette.shading;
    ctx.fill();
    if (hatched) {
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      const step = Math.max(column.radius / 2.2, strokeWidth(env, style.strokes.hatching) * 2.2);
      for (let k = -column.radius * 2; k <= column.radius * 2; k += step) {
        ctx.moveTo(column.x + k - column.radius, column.y + column.radius);
        ctx.lineTo(column.x + k + column.radius, column.y - column.radius);
      }
      ctx.lineWidth = strokeWidth(env, style.strokes.hatching) * 0.8;
      ctx.stroke();
      ctx.restore();
      traceColumn(ctx, column);
    }
    ctx.lineWidth = outline;
    ctx.stroke();
    ctx.restore();
  }
}

function traceColumn(ctx: CanvasPath & { beginPath(): void }, c: DungeonColumn): void {
  ctx.beginPath();
  if (c.square) ctx.rect(c.x - c.radius, c.y - c.radius, c.radius * 2, c.radius * 2);
  else ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
}
