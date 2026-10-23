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

/** Depth: the hole's rock faces going down from its rim, darker the deeper, to a dark bottom. */
function depth(env: RenderEnv, pen: GlyphPen, rings: readonly Vec[][]): void {
  const { ctx } = pen;
  const colours = terrainColours(env);
  const layers: [number, string][] = [
    [0, colours.face],
    [0.14, colours.deep],
    [0.3, env.palette.ink],
  ];
  for (const [inset, colour] of layers) {
    ctx.beginPath();
    traceRings(ctx, rings.map((r) => insetRing(r, inset)));
    ctx.fillStyle = colour;
    ctx.fill();
  }
  const bottom = rings.map((r) => insetRing(r, 0.3));
  ctx.save();
  ctx.strokeStyle = env.view.monochrome ? env.palette.fill : colours.face;
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

/** A parapet along a gallery's rim where it meets floor: a low rail on the floor beside the rim, posts at a steady beat. */
function parapet(pen: GlyphPen, edges: readonly CellEdge[]): void {
  const { ctx } = pen;
  const rails: Vec[][] = edges.map((e) => {
    const d = { x: e.to.x - e.from.x, y: e.to.y - e.from.y };
    // Outwards is on the left of the way along the edge (the hole lies on its right).
    const out = { x: d.y * PARAPET, y: -d.x * PARAPET };
    return [e.from, e.to, { x: e.to.x + out.x, y: e.to.y + out.y }, { x: e.from.x + out.x, y: e.from.y + out.y }];
  });
  ctx.beginPath();
  traceRings(ctx, rails);
  ctx.fillStyle = pen.palette.fill;
  ctx.fill();
  ctx.stroke();
  const posts: number[] = [];
  for (const [a, b, c] of rails as [Vec, Vec, Vec, Vec][]) {
    const count = 3;
    for (let k = 1; k < count; k++) {
      const x = a.x + ((b.x - a.x) * k) / count;
      const y = a.y + ((b.y - a.y) * k) / count;
      posts.push(x, y, x + (c.x - b.x), y + (c.y - b.y));
    }
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
    if (hole.kind === 'gallery') parapet(pen, edgesFacing(hole.cells, (c) => !own.has(`${c.x},${c.y}`) && env.dungeon.field.distance(c.x + 0.5, c.y + 0.5) < 0));
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
