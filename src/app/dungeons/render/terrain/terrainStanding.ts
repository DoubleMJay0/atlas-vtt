/**
 * Terrain that stands: cover and points of interest, each filling its cells and casting a shadow
 * as tall as it stands. Low cover (crates, a table, an altar, a sarcophagus, a rubble heap, a low
 * wall) is drawn in the props' family; total cover (pillars, statues, wall fragments, obelisks) is
 * heavier, so it reads at a glance as something nobody sees past.
 */

import type { DungeonTerrain, TerrainKind } from '../../model';
import { facing as facingAngle } from '../../props/roomFrame';
import { bevel, block, circlePath, disc, fineLines, fineRing, inkDot, roundedRect, strokeFine, type GlyphPen } from '../glyphPen';
import { drawPropShape } from '../propShapes';
import type { RenderEnv } from '../renderEnv';
import { cellBox } from './cellRings';
import { castShadow, pieceRng, roomAxis, shownPieces, terrainPen } from './terrainPen';

const STANDING: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  'low-wall',
  'crates',
  'table',
  'altar',
  'sarcophagus',
  'rubble-heap',
  'pillar',
  'statue',
  'wall-fragment',
  'obelisk',
  'lever',
  'pool',
  'portal-ring',
]);

/** How tall each stands, as a share of a column's shadow. */
const LIFT: Readonly<Partial<Record<TerrainKind, number>>> = {
  'low-wall': 0.45,
  crates: 0.5,
  table: 0.35,
  altar: 0.45,
  sarcophagus: 0.4,
  'rubble-heap': 0.4,
  pillar: 1.3,
  statue: 1.1,
  'wall-fragment': 1.3,
  obelisk: 1.2,
  lever: 0.2,
  pool: 0.15,
  'portal-ring': 0.8,
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

function boxOf(piece: DungeonTerrain, inset: number): Box {
  const b = cellBox(piece.cells);
  return { x: b.x + inset, y: b.y + inset, w: b.w - inset * 2, h: b.h - inset * 2, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}

function crates(pen: GlyphPen, rng: () => number, piece: DungeonTerrain): void {
  for (const c of piece.cells) {
    const spots = [
      [0.3, 0.3, 0.42],
      [0.7, 0.32, 0.36],
      [0.5, 0.7, 0.44],
    ] as const;
    for (const [dx, dy, s] of spots) {
      const x = c.x + dx;
      const y = c.y + dy;
      pen.ctx.save();
      pen.ctx.translate(x, y);
      pen.ctx.rotate((rng() - 0.5) * 0.35);
      block(pen, 0, 0, s, s);
      fineLines(pen, [-s / 2, -s / 2, s / 2, s / 2, -s / 2, s / 2, s / 2, -s / 2]);
      pen.ctx.restore();
    }
  }
}

function table(pen: GlyphPen, box: Box, along: boolean): void {
  block(pen, box.cx, box.cy, box.w, box.h, pen.palette.fill, 0.06);
  const boards = Math.max(2, Math.round((along ? box.h : box.w) / 0.22));
  const lines: number[] = [];
  for (let k = 1; k < boards; k++) {
    const t = k / boards;
    if (along) lines.push(box.x, box.y + box.h * t, box.x + box.w, box.y + box.h * t);
    else lines.push(box.x + box.w * t, box.y, box.x + box.w * t, box.y + box.h);
  }
  fineLines(pen, lines);
}

function altar(pen: GlyphPen, box: Box, along: boolean): void {
  block(pen, box.cx, box.cy, box.w, box.h);
  bevel(pen, box.cx, box.cy, box.w, box.h);
  const [w, h] = along ? [box.w * 0.4, box.h + 0.06] : [box.w + 0.06, box.h * 0.4];
  pen.ctx.beginPath();
  roundedRect(pen.ctx, box.cx, box.cy, w, h);
  pen.ctx.fillStyle = pen.palette.fill;
  pen.ctx.fill();
  strokeFine(pen);
}

function sarcophagus(pen: GlyphPen, box: Box, along: boolean): void {
  block(pen, box.cx, box.cy, box.w, box.h, pen.palette.fill, 0.12);
  bevel(pen, box.cx, box.cy, box.w, box.h, 0.09);
  const ridge = along ? [box.cx - box.w * 0.3, box.cy, box.cx + box.w * 0.3, box.cy] : [box.cx, box.cy - box.h * 0.3, box.cx, box.cy + box.h * 0.3];
  fineLines(pen, ridge);
}

function rubbleHeap(pen: GlyphPen, rng: () => number, piece: DungeonTerrain): void {
  const { ctx } = pen;
  for (const c of piece.cells) {
    for (let k = 0; k < 6; k++) {
      const x = c.x + 0.22 + rng() * 0.56;
      const y = c.y + 0.22 + rng() * 0.56;
      const r = 0.12 + rng() * 0.1;
      ctx.beginPath();
      for (let v = 0; v < 5; v++) {
        const a = (v / 5) * Math.PI * 2 + rng() * 0.6;
        const rr = r * (0.75 + rng() * 0.4);
        if (v === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = pen.palette.fill;
      ctx.fill();
      ctx.stroke();
    }
  }
}

function lowWall(pen: GlyphPen, box: Box, alongJ: boolean): void {
  const [w, h] = alongJ ? [box.w, 0.42] : [0.42, box.h];
  block(pen, box.cx, box.cy, w, h);
  const stones = Math.max(2, Math.round((alongJ ? w : h) / 0.33));
  const lines: number[] = [];
  for (let k = 1; k < stones; k++) {
    const t = k / stones;
    if (alongJ) lines.push(box.cx - w / 2 + w * t, box.cy - h / 2, box.cx - w / 2 + w * t, box.cy + h / 2);
    else lines.push(box.cx - w / 2, box.cy - h / 2 + h * t, box.cx + w / 2, box.cy - h / 2 + h * t);
  }
  fineLines(pen, lines);
}

function wallFragment(pen: GlyphPen, box: Box, alongJ: boolean): void {
  const { ctx } = pen;
  const thick = 0.34;
  const [w, h] = alongJ ? [box.w, thick] : [thick, box.h];
  ctx.beginPath();
  // Broken ends: the long sides stop at different lengths.
  if (alongJ) {
    ctx.moveTo(box.cx - w / 2 + 0.04, box.cy - h / 2);
    ctx.lineTo(box.cx + w / 2 - 0.1, box.cy - h / 2);
    ctx.lineTo(box.cx + w / 2, box.cy + 0.02);
    ctx.lineTo(box.cx + w / 2 - 0.02, box.cy + h / 2);
    ctx.lineTo(box.cx - w / 2 + 0.12, box.cy + h / 2);
    ctx.lineTo(box.cx - w / 2, box.cy - 0.03);
  } else {
    ctx.moveTo(box.cx - w / 2, box.cy - h / 2 + 0.04);
    ctx.lineTo(box.cx + w / 2, box.cy - h / 2 + 0.12);
    ctx.lineTo(box.cx + w / 2, box.cy + h / 2 - 0.02);
    ctx.lineTo(box.cx + 0.02, box.cy + h / 2);
    ctx.lineTo(box.cx - w / 2, box.cy + h / 2 - 0.1);
  }
  ctx.closePath();
  ctx.fillStyle = pen.palette.ink;
  ctx.fill();
  ctx.stroke();
}

function pillar(pen: GlyphPen, box: Box): void {
  block(pen, box.cx, box.cy, box.w, box.h);
  bevel(pen, box.cx, box.cy, box.w, box.h, Math.min(box.w, box.h) * 0.16);
  pen.ctx.beginPath();
  roundedRect(pen.ctx, box.cx, box.cy, box.w * 0.5, box.h * 0.5);
  strokeFine(pen);
}

function obelisk(pen: GlyphPen, box: Box): void {
  block(pen, box.cx, box.cy, box.w, box.h);
  const s = Math.min(box.w, box.h) * 0.55;
  pen.ctx.beginPath();
  roundedRect(pen.ctx, box.cx, box.cy, s, s);
  pen.ctx.fillStyle = pen.palette.fill;
  pen.ctx.fill();
  pen.ctx.stroke();
  fineLines(pen, [box.cx - s / 2, box.cy - s / 2, box.cx + s / 2, box.cy + s / 2, box.cx - s / 2, box.cy + s / 2, box.cx + s / 2, box.cy - s / 2]);
  inkDot(pen, box.cx, box.cy, s * 0.08);
}

function statue(pen: GlyphPen, box: Box, rotation: number, fine: number): void {
  block(pen, box.cx, box.cy, box.w, box.h);
  bevel(pen, box.cx, box.cy, box.w, box.h, 0.06);
  const { ctx } = pen;
  ctx.save();
  ctx.translate(box.cx, box.cy);
  ctx.rotate(rotation);
  const scale = Math.min(box.w, box.h) * 1.35;
  ctx.scale(scale, scale);
  ctx.lineWidth /= scale;
  drawPropShape('statue', { ctx, palette: pen.palette, fine: fine / scale });
  ctx.restore();
}

function lever(pen: GlyphPen, box: Box, rotation: number): void {
  const { ctx } = pen;
  ctx.save();
  ctx.translate(box.cx, box.cy);
  ctx.rotate(rotation);
  // Its plate against the wall behind (towards +y once turned), the handle leaning into the room.
  block(pen, 0, 0.3, 0.44, 0.16);
  ctx.beginPath();
  ctx.moveTo(-0.08, 0.26);
  ctx.lineTo(0.12, -0.1);
  ctx.stroke();
  inkDot(pen, 0.12, -0.1, 0.06);
  ctx.restore();
}

function pool(pen: GlyphPen, box: Box, fine: number): void {
  const r = Math.min(box.w, box.h) / 2;
  disc(pen, box.cx, box.cy, r);
  const { ctx } = pen;
  ctx.beginPath();
  circlePath(ctx, r * 0.72, box.cx, box.cy);
  ctx.fillStyle = pen.palette.water;
  ctx.fill();
  strokeFine({ ...pen, fine });
  fineRing(pen, box.cx, box.cy, r * 0.4);
}

function portalRing(pen: GlyphPen, box: Box): void {
  const r = Math.min(box.w, box.h) / 2 - 0.1;
  const stones = 8;
  fineRing(pen, box.cx, box.cy, r * 0.62);
  for (let k = 0; k < stones; k++) {
    const a = (k / stones) * Math.PI * 2;
    const { ctx } = pen;
    ctx.save();
    ctx.translate(box.cx + Math.cos(a) * r, box.cy + Math.sin(a) * r);
    ctx.rotate(a);
    block(pen, 0, 0, 0.22, 0.3);
    ctx.restore();
  }
}

function drawPiece(env: RenderEnv, pen: GlyphPen, piece: DungeonTerrain, fine: number): void {
  const rng = pieceRng(env, piece);
  const axis = roomAxis(env, piece);
  const b = cellBox(piece.cells);
  const lengthX = b.w >= b.h;
  const rotation = facingAngle(piece.facing ?? { x: -axis.x as -1 | 0 | 1, y: -axis.y as -1 | 0 | 1 });
  switch (piece.kind) {
    case 'crates':
      return crates(pen, rng, piece);
    case 'table':
      return table(pen, boxOf(piece, 0.12), !lengthX);
    case 'altar':
      return altar(pen, boxOf(piece, 0.14), !lengthX);
    case 'sarcophagus':
      return sarcophagus(pen, boxOf(piece, 0.16), lengthX);
    case 'rubble-heap':
      return rubbleHeap(pen, rng, piece);
    case 'low-wall':
      return lowWall(pen, boxOf(piece, 0.04), lengthX);
    case 'wall-fragment':
      return wallFragment(pen, boxOf(piece, 0.02), lengthX);
    case 'pillar':
      return pillar(pen, boxOf(piece, 0.1));
    case 'obelisk':
      return obelisk(pen, boxOf(piece, 0.14));
    case 'statue':
      return statue(pen, boxOf(piece, 0.18), rotation, fine);
    case 'lever':
      return lever(pen, boxOf(piece, 0), rotation);
    case 'pool':
      return pool(pen, boxOf(piece, 0.1), fine);
    case 'portal-ring':
      return portalRing(pen, boxOf(piece, 0.04));
    default:
      return;
  }
}

/** The outline a standing piece casts its shadow from. */
function silhouette(env: RenderEnv, piece: DungeonTerrain): void {
  const box = boxOf(piece, piece.kind === 'portal-ring' || piece.kind === 'crates' ? 0.18 : 0.12);
  if (piece.kind === 'pool') {
    circlePath(env.ctx, Math.min(box.w, box.h) / 2, box.cx, box.cy);
    return;
  }
  roundedRect(env.ctx, box.cx, box.cy, box.w, box.h);
}

export function drawTerrainStanding(env: RenderEnv): void {
  const pieces = shownPieces(env, STANDING);
  if (pieces.length === 0) return;
  const { ctx } = env;
  ctx.save();
  const pen = terrainPen(env);
  for (const piece of pieces) castShadow(env, LIFT[piece.kind] ?? 0.4, () => silhouette(env, piece));
  for (const piece of pieces) drawPiece(env, pen, piece, pen.fine);
  ctx.restore();
}
