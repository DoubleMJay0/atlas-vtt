/**
 * Terrain that lies on or below the floor, drawn before what stands on it: difficult ground (pews,
 * loose rubble, broken floor, the rubble under a hole above), mosaics, pits, deep water, channels
 * of lava, acid or water and the stone bridges over them. Every edge lies on cell lines, so a cell
 * reads plainly as one thing (Map-Fu).
 */

import type { CellPoint, DungeonTerrain } from '../../model';
import { mixColours } from '../palette';
import type { RenderEnv } from '../renderEnv';
import { bevel, fineLines, roundedRect, strokeFine, type GlyphPen } from '../glyphPen';
import { cellBox, cellRings, edgesFacing, insetRing, traceRings } from './cellRings';
import { castShadow, pieceRng, roomAxis, shownPieces, terrainColours, terrainPen } from './terrainPen';

const GROUND = new Set(['pews', 'rubble-field', 'broken-floor', 'chasm-floor', 'mosaic', 'pit', 'deep-water', 'channel'] as const);

/** A rough stone of radius about `r` at (x, y). */
function stone(pen: GlyphPen, rng: () => number, x: number, y: number, r: number): void {
  const { ctx } = pen;
  const start = rng() * Math.PI * 2;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = start + (k / 6) * Math.PI * 2;
    const rr = r * (0.7 + rng() * 0.5);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = pen.palette.fill;
  ctx.fill();
  strokeFine(pen);
}

function stonesIn(pen: GlyphPen, rng: () => number, cells: readonly CellPoint[], perCell: number, size: number): void {
  for (const c of cells) {
    for (let k = 0; k < perCell; k++) stone(pen, rng, c.x + 0.15 + rng() * 0.7, c.y + 0.15 + rng() * 0.7, size * (0.6 + rng() * 0.8));
  }
}

/** Pews: a bench across each cell, its back towards the room's far wall. */
function pews(env: RenderEnv, pen: GlyphPen, piece: DungeonTerrain): void {
  const { ctx } = pen;
  const axis = roomAxis(env, piece);
  const along = axis.x !== 0;
  for (const c of piece.cells) {
    const cx = c.x + 0.5;
    const cy = c.y + 0.5;
    const [w, h] = along ? [0.36, 1.02] : [1.02, 0.36];
    ctx.beginPath();
    roundedRect(ctx, cx, cy, w, h);
    ctx.fillStyle = pen.palette.fill;
    ctx.fill();
    ctx.stroke();
    const back = { x: cx + axis.x * 0.1, y: cy + axis.y * 0.1 };
    fineLines(pen, along ? [back.x, c.y + 0.02, back.x, c.y + 0.98] : [c.x + 0.02, back.y, c.x + 0.98, back.y]);
  }
}

/** Broken floor: each cell split into tilted slabs, one sunk a little darker. */
function brokenFloor(env: RenderEnv, pen: GlyphPen, piece: DungeonTerrain): void {
  const { ctx } = pen;
  const rng = pieceRng(env, piece);
  const { shade } = terrainColours(env);
  for (const c of piece.cells) {
    const mx = c.x + 0.3 + rng() * 0.4;
    const my = c.y + 0.3 + rng() * 0.4;
    const corners = [
      [c.x, c.y + rng() * 0.6],
      [c.x + 0.4 + rng() * 0.6, c.y],
      [c.x + 1, c.y + 0.4 + rng() * 0.6],
      [c.x + rng() * 0.6, c.y + 1],
    ] as const;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(corners[0][0], corners[0][1]);
    ctx.lineTo(c.x, c.y + 1);
    ctx.lineTo(corners[3][0], corners[3][1]);
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();
    fineLines(pen, corners.flatMap(([x, y]) => [mx, my, x, y]));
  }
}

/** A mosaic: a bordered square of the floor laid with a pattern of lozenges round a rosette. */
function mosaic(pen: GlyphPen, piece: DungeonTerrain, raised: string): void {
  const { ctx } = pen;
  const box = cellBox(piece.cells);
  const inset = 0.14;
  const x = box.x + inset;
  const y = box.y + inset;
  const w = box.w - inset * 2;
  const h = box.h - inset * 2;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = raised;
  ctx.fill();
  strokeFine(pen);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const lines: number[] = [];
  for (let k = 1; k < box.w * 2; k++) {
    const t = k / (box.w * 2);
    lines.push(x + w * t, y, x, y + h * t, x + w * t, y + h, x + w, y + h * t);
    lines.push(x + w * t, y, x + w, y + h * (1 - t), x + w * t, y + h, x, y + h * (1 - t));
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = 0.55;
  fineLines(pen, lines);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = pen.palette.fill;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.1, 0, Math.PI * 2);
  strokeFine(pen);
}

/** A pit: its walls going down to a dark bottom, inked at its rim. */
function pit(env: RenderEnv, pen: GlyphPen, piece: DungeonTerrain): void {
  const { ctx } = pen;
  const colours = terrainColours(env);
  const rings = cellRings(piece.cells);
  const rim = rings.map((r) => insetRing(r, 0.06));
  const bottom = rings.map((r) => insetRing(r, 0.26));
  ctx.beginPath();
  traceRings(ctx, rim);
  ctx.fillStyle = colours.shade;
  ctx.fill();
  ctx.beginPath();
  traceRings(ctx, bottom);
  ctx.fillStyle = colours.deep;
  ctx.fill();
  rim.forEach((ring, k) => fineLines(pen, ring.flatMap((p, i) => [p.x, p.y, bottom[k]![i]!.x, bottom[k]![i]!.y])));
  ctx.beginPath();
  traceRings(ctx, rim);
  ctx.stroke();
}

/** Deep water: whole cells of darker water with an inked edge and a few ripples. */
function deepWater(env: RenderEnv, pen: GlyphPen, piece: DungeonTerrain): void {
  const { ctx } = pen;
  const rng = pieceRng(env, piece);
  const rings = cellRings(piece.cells).map((r) => insetRing(r, 0.05));
  ctx.beginPath();
  traceRings(ctx, rings);
  ctx.fillStyle = terrainColours(env).deepWater;
  ctx.fill();
  ctx.stroke();
  for (const c of piece.cells) {
    if (rng() < 0.4) continue;
    ctx.beginPath();
    const r = 0.12 + rng() * 0.12;
    const a = rng() * Math.PI * 2;
    ctx.arc(c.x + 0.5, c.y + 0.5, r, a, a + Math.PI * 0.8);
    strokeFine(pen);
  }
}

/** A channel: a run of lava, acid or water from wall to wall, its banks inked where they meet floor. */
function channel(env: RenderEnv, pen: GlyphPen, piece: DungeonTerrain, onPiece: (c: CellPoint) => boolean): void {
  const { ctx } = pen;
  const colours = terrainColours(env);
  const hazard = piece.traits.hazard;
  const fill = hazard === 'lava' ? colours.lava : hazard === 'acid' ? colours.acid : colours.deepWater;
  ctx.beginPath();
  traceRings(ctx, cellRings(piece.cells));
  ctx.fillStyle = fill;
  ctx.fill();
  const rng = pieceRng(env, piece);
  ctx.save();
  ctx.beginPath();
  traceRings(ctx, cellRings(piece.cells));
  ctx.clip();
  ctx.globalAlpha = hazard === 'lava' ? 0.7 : 0.45;
  const flow = piece.facing ?? { x: 1, y: 0 };
  const lines: number[] = [];
  for (const c of piece.cells) {
    for (let k = 0; k < 2; k++) {
      const ox = c.x + 0.2 + rng() * 0.6;
      const oy = c.y + 0.2 + rng() * 0.6;
      lines.push(ox, oy, ox + flow.x * 0.35, oy + flow.y * 0.35);
    }
  }
  ctx.strokeStyle = hazard === 'lava' ? mixColours(fill, '#fff3c0', 0.6) : pen.palette.ink;
  fineLines(pen, lines);
  ctx.restore();
  const banks = edgesFacing(piece.cells, (c) => !onPiece(c) && env.dungeon.field.distance(c.x + 0.5, c.y + 0.5) < 0);
  ctx.beginPath();
  for (const e of banks) {
    ctx.moveTo(e.from.x, e.from.y);
    ctx.lineTo(e.to.x, e.to.y);
  }
  ctx.stroke();
}

/** A stone bridge over a channel: a bevelled slab a little longer than the channel is wide. */
export function stoneBridge(env: RenderEnv, pen: GlyphPen, piece: DungeonTerrain): void {
  const { ctx } = pen;
  const box = cellBox(piece.cells);
  const along = piece.facing ?? { x: 0, y: 1 };
  const reach = 0.22;
  const w = along.x !== 0 ? box.w + reach * 2 : 0.7;
  const h = along.x !== 0 ? 0.7 : box.h + reach * 2;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  castShadow(env, 0.35, () => roundedRect(ctx, cx, cy, w, h));
  ctx.beginPath();
  roundedRect(ctx, cx, cy, w, h);
  ctx.fillStyle = pen.palette.fill;
  ctx.fill();
  ctx.stroke();
  bevel(pen, cx, cy, w, h, 0.08);
}

/** Every piece that lies on or below the floor, with the bridges over channels. */
export function drawTerrainGround(env: RenderEnv): void {
  const pieces = shownPieces(env, GROUND);
  if (pieces.length === 0) return;
  const { ctx } = env;
  ctx.save();
  const pen = terrainPen(env);
  const colours = terrainColours(env);
  for (const piece of pieces) {
    const rng = pieceRng(env, piece);
    switch (piece.kind) {
      case 'pews':
        pews(env, pen, piece);
        break;
      case 'rubble-field':
        stonesIn(pen, rng, piece.cells, 6, 0.07);
        break;
      case 'chasm-floor':
        stonesIn(pen, rng, piece.cells, 5, 0.1);
        break;
      case 'broken-floor':
        brokenFloor(env, pen, piece);
        break;
      case 'mosaic':
        mosaic(pen, piece, colours.raised);
        break;
      case 'pit':
        pit(env, pen, piece);
        break;
      case 'deep-water':
        deepWater(env, pen, piece);
        break;
      case 'channel': {
        const own = new Set(piece.cells.map((c) => `${c.x},${c.y}`));
        channel(env, pen, piece, (c) => own.has(`${c.x},${c.y}`));
        break;
      }
      default:
        break;
    }
  }
  const terrain = env.dungeon.floor.terrain;
  for (const bridge of shownPieces(env, new Set(['bridge']))) {
    if (terrain[bridge.spans ?? -1]?.kind === 'channel') stoneBridge(env, pen, bridge);
  }
  ctx.restore();
}
