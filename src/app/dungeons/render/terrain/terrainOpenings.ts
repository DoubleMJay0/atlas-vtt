/**
 * Holes in the floor (chasms, shafts, galleries) and the bridges over them. Where a floor lies
 * below, a hole is cut out of the image exactly on its cells, so the scene shows the level below
 * through it (and a token stepping in falls); its lip stays inked on the floor side. On the deepest
 * floor, or when holes are `drawn`, it is painted as depth: rock faces going down into the dark. A
 * gallery's rim carries a parapet; a bridge over a hole is planks between two ropes, drawn over the cut.
 */

import type { DungeonTerrain } from '../../model';
import { HOLE_KINDS } from '../../terrain/catalog';
import { fineLines, strokeFine, type GlyphPen } from '../glyphPen';
import type { RenderEnv } from '../renderEnv';
import { type CellEdge, cellBox, cellRings, edgesFacing, insetRing, traceRings } from './cellRings';
import { castShadow, shownPieces, terrainColours, terrainPen } from './terrainPen';
import type { Vec } from '../geometry';

/** How wide a gallery's parapet is, in cells, standing on the floor round the hole. */
const PARAPET = 0.16;

function isHole(piece: DungeonTerrain): boolean {
  return piece.opening !== undefined && HOLE_KINDS.has(piece.kind);
}

/** Whether holes on this floor are cut out: a floor lies below and the picture is not to stand alone. */
function cuts(env: RenderEnv): boolean {
  return env.openings === 'cut' && env.dungeon.index < env.dungeon.model.floors.length - 1;
}

/** Depth: the hole filled dark, rock faces from its rim down to a darker bottom. */
function depth(env: RenderEnv, pen: GlyphPen, rings: readonly Vec[][]): void {
  const { ctx } = pen;
  const colours = terrainColours(env);
  ctx.beginPath();
  traceRings(ctx, rings);
  ctx.fillStyle = colours.deep;
  ctx.fill();
  const bottom = rings.map((r) => insetRing(r, 0.22));
  ctx.beginPath();
  traceRings(ctx, bottom);
  ctx.fillStyle = env.palette.ink;
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = env.view.monochrome ? env.palette.fill : colours.shade;
  rings.forEach((ring, k) => fineLines(pen, ring.flatMap((p, i) => [p.x, p.y, bottom[k]![i]!.x, bottom[k]![i]!.y])));
  ctx.restore();
}

/** The lip: the hole's border inked heavier than a glyph, on the floor's side of the cell lines. */
function lip(pen: GlyphPen, edges: readonly CellEdge[]): void {
  const { ctx } = pen;
  ctx.save();
  ctx.lineWidth *= 1.6;
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (const e of edges) {
    ctx.moveTo(e.from.x, e.from.y);
    ctx.lineTo(e.to.x, e.to.y);
  }
  ctx.stroke();
  ctx.restore();
}

/** A parapet round a gallery's hole: a low rail on the floor beside the rim, posts at a steady beat. */
function parapet(pen: GlyphPen, rings: readonly Vec[][]): void {
  const { ctx } = pen;
  const outer = rings.map((r) => insetRing(r, -PARAPET));
  ctx.beginPath();
  traceRings(ctx, outer);
  traceRings(ctx, rings.map((r) => [...r].reverse()));
  ctx.fillStyle = pen.palette.fill;
  ctx.fill();
  ctx.beginPath();
  traceRings(ctx, outer);
  ctx.stroke();
  const posts: number[] = [];
  for (const ring of rings) {
    const mid = insetRing(ring, -PARAPET / 2);
    mid.forEach((p, i) => {
      const q = mid[(i + 1) % mid.length] as Vec;
      const length = Math.hypot(q.x - p.x, q.y - p.y);
      const count = Math.max(1, Math.round(length / 0.33));
      for (let k = 0; k <= count; k++) {
        const x = p.x + ((q.x - p.x) * k) / count;
        const y = p.y + ((q.y - p.y) * k) / count;
        const nx = ((q.y - p.y) / length) * PARAPET * 0.5;
        const ny = (-(q.x - p.x) / length) * PARAPET * 0.5;
        posts.push(x - nx, y - ny, x + nx, y + ny);
      }
    });
  }
  fineLines(pen, posts);
}

/** A rope bridge over a hole: planks across the whole cell between two ropes, reaching onto the floor at both ends. */
function ropeBridge(env: RenderEnv, pen: GlyphPen, piece: DungeonTerrain, cut: boolean): void {
  const { ctx } = pen;
  const box = cellBox(piece.cells);
  const along = piece.facing ?? { x: 0, y: 1 };
  const reach = 0.2;
  const horizontal = along.x !== 0;
  const x0 = horizontal ? box.x - reach : box.x;
  const y0 = horizontal ? box.y : box.y - reach;
  const w = horizontal ? box.w + reach * 2 : box.w;
  const h = horizontal ? box.h : box.h + reach * 2;
  if (!cut) castShadow(env, 0.6, () => ctx.rect(x0 + (horizontal ? 0 : 0.08), y0 + (horizontal ? 0.08 : 0), horizontal ? w : w - 0.16, horizontal ? h - 0.16 : h));
  ctx.beginPath();
  ctx.rect(x0 + (horizontal ? 0 : 0.06), y0 + (horizontal ? 0.06 : 0), horizontal ? w : w - 0.12, horizontal ? h - 0.12 : h);
  ctx.fillStyle = pen.palette.fill;
  ctx.fill();
  if (cut) {
    // Nothing of the hole may show beside the deck, or the floor below would show through slivers.
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.fill();
  }
  const planks: number[] = [];
  const count = Math.round((horizontal ? w : h) / 0.18);
  for (let k = 1; k < count; k++) {
    const t = k / count;
    if (horizontal) planks.push(x0 + w * t, y0 + 0.1, x0 + w * t, y0 + h - 0.1);
    else planks.push(x0 + 0.1, y0 + h * t, x0 + w - 0.1, y0 + h * t);
  }
  fineLines(pen, planks);
  ctx.beginPath();
  if (horizontal) {
    ctx.moveTo(x0, y0 + 0.08);
    ctx.lineTo(x0 + w, y0 + 0.08);
    ctx.moveTo(x0, y0 + h - 0.08);
    ctx.lineTo(x0 + w, y0 + h - 0.08);
  } else {
    ctx.moveTo(x0 + 0.08, y0);
    ctx.lineTo(x0 + 0.08, y0 + h);
    ctx.moveTo(x0 + w - 0.08, y0);
    ctx.lineTo(x0 + w - 0.08, y0 + h);
  }
  ctx.stroke();
  strokeFine(pen);
}

export function drawTerrainOpenings(env: RenderEnv): void {
  const holes = shownPieces(env).filter(isHole);
  if (holes.length === 0) return;
  const { ctx } = env;
  const cut = cuts(env);
  ctx.save();
  const pen = terrainPen(env);
  for (const hole of holes) {
    const rings = cellRings(hole.cells);
    const own = new Set(hole.cells.map((c) => `${c.x},${c.y}`));
    const rim = edgesFacing(hole.cells, (c) => !own.has(`${c.x},${c.y}`));
    if (hole.kind === 'gallery') parapet(pen, rings);
    if (cut) {
      lip(pen, rim);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      traceRings(ctx, rings);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();
    } else {
      depth(env, pen, rings);
      lip(pen, rim);
    }
  }
  const byId = env.dungeon.floor.terrain;
  for (const bridge of shownPieces(env, new Set(['bridge']))) {
    const under = byId[bridge.spans ?? -1];
    if (under && isHole(under)) ropeBridge(env, pen, bridge, cut);
  }
  ctx.restore();
}
