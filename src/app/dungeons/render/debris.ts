import type { CellPoint, DungeonCrack } from '../model';
import { clipToFloors } from './floors';
import { traceSmoothClosed, type Vec } from './geometry';
import { strokeWidth, type RenderEnv } from './renderEnv';

/** Cracks: tapered ink wedges from the walls into the rooms, cut to the floors. */
export function drawCracks(env: RenderEnv): void {
  const { ctx, palette, dungeon } = env;
  if (!env.view.props || dungeon.floor.cracks.length === 0) return;
  ctx.save();
  clipToFloors(env);
  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  for (const crack of dungeon.floor.cracks) {
    const outline = taperedOutline(crack);
    if (outline.length < 3) continue;
    ctx.moveTo(outline[0]!.x, outline[0]!.y);
    for (const p of outline.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

/** A polyline turned into a polygon whose width runs from the crack's width down to nothing. */
export function taperedOutline(crack: DungeonCrack): Vec[] {
  const pts = crack.points;
  const n = pts.length;
  if (n < 2) return [];
  const left: Vec[] = [];
  const right: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const half = (crack.width / 2) * (1 - i / (n - 1));
    const normal = miterNormal(pts, i);
    const p = pts[i]!;
    left.push({ x: p.x + normal.x * half, y: p.y + normal.y * half });
    right.push({ x: p.x - normal.x * half, y: p.y - normal.y * half });
  }
  return [...left, ...right.reverse()];
}

/** The offset direction at a corner, lengthened so both sides keep their width (capped at 2). */
function miterNormal(pts: readonly CellPoint[], i: number): Vec {
  const normalOf = (a: CellPoint, b: CellPoint): Vec => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  };
  const before = i > 0 ? normalOf(pts[i - 1]!, pts[i]!) : null;
  const after = i < pts.length - 1 ? normalOf(pts[i]!, pts[i + 1]!) : null;
  if (!before) return after!;
  if (!after) return before;
  const sx = before.x + after.x;
  const sy = before.y + after.y;
  const len = Math.hypot(sx, sy) || 1;
  const m = { x: sx / len, y: sy / len };
  const scale = Math.min(2, 1 / Math.max(0.5, m.x * after.x + m.y * after.y));
  return { x: m.x * scale, y: m.y * scale };
}

/** Rubble: small rounded stones in the palette's fill, outlined in ink. */
export function drawRubble(env: RenderEnv): void {
  const { ctx, palette, dungeon, style } = env;
  if (!env.view.props || dungeon.floor.rubble.length === 0) return;
  ctx.save();
  clipToFloors(env);
  ctx.beginPath();
  for (const stone of dungeon.floor.rubble) traceSmoothClosed(ctx, stone.points);
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = 'round';
  ctx.lineWidth = strokeWidth(env, style.strokes.normal);
  ctx.stroke();
  ctx.restore();
}
