/**
 * Height without text (Map-Fu): a platform or ledge is a lighter top inked at its rim, casting a
 * shadow onto the floor below its open sides, with ticks hanging from those sides that grow with
 * its height, and treads where its steps lead up. Sides against a wall have no ticks.
 */

import type { CellDir, CellPoint, DungeonTerrain } from '../../model';
import { fineLines, type GlyphPen } from '../glyphPen';
import type { RenderEnv } from '../renderEnv';
import { cellRings, edgesFacing, traceRings } from './cellRings';
import { castShadow, shownPieces, terrainColours, terrainPen } from './terrainPen';

const RAISED = new Set(['platform', 'ledge'] as const);
/** How far apart the ticks along an open side stand, in cells. */
const TICK_SPACING = 0.16;

/** Ticks hanging outwards from the open sides, longer the higher the top. */
function ticks(env: RenderEnv, pen: GlyphPen, piece: DungeonTerrain, own: (c: CellPoint) => boolean): void {
  const length = 0.06 + 0.06 * (piece.traits.elevation ?? 1);
  const open = edgesFacing(piece.cells, (c) => !own(c) && env.dungeon.field.distance(c.x + 0.5, c.y + 0.5) < 0);
  const lines: number[] = [];
  for (const edge of open) {
    const d = { x: edge.to.x - edge.from.x, y: edge.to.y - edge.from.y };
    const out = { x: d.y, y: -d.x };
    const count = Math.round(1 / TICK_SPACING);
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      const x = edge.from.x + d.x * t;
      const y = edge.from.y + d.y * t;
      const long = k % 2 === 0 ? length : length * 0.55;
      lines.push(x, y, x + out.x * long, y + out.y * long);
    }
  }
  fineLines(pen, lines);
}

/** Treads across each step cell, from its front edge back, the lowest nearest the floor. */
function treads(pen: GlyphPen, steps: readonly CellPoint[], facing: CellDir): void {
  const lines: number[] = [];
  for (const c of steps) {
    const front = { x: c.x + 0.5 + facing.x * 0.5, y: c.y + 0.5 + facing.y * 0.5 };
    for (const depth of [0.12, 0.26, 0.4]) {
      const x = front.x - facing.x * depth;
      const y = front.y - facing.y * depth;
      if (facing.x !== 0) lines.push(x, c.y + 0.12, x, c.y + 0.88);
      else lines.push(c.x + 0.12, y, c.x + 0.88, y);
    }
  }
  fineLines(pen, lines);
}

export function drawTerrainRaised(env: RenderEnv): void {
  const pieces = shownPieces(env, RAISED);
  if (pieces.length === 0) return;
  const { ctx } = env;
  ctx.save();
  const pen = terrainPen(env);
  const { raised } = terrainColours(env);
  for (const piece of pieces) {
    const rings = cellRings(piece.cells);
    const own = new Set(piece.cells.map((c) => `${c.x},${c.y}`));
    castShadow(env, 0.5 * (piece.traits.elevation ?? 1), () => traceRings(ctx, rings));
    ctx.beginPath();
    traceRings(ctx, rings);
    ctx.fillStyle = raised;
    ctx.fill();
    ctx.stroke();
    ticks(env, pen, piece, (c) => own.has(`${c.x},${c.y}`));
    if (piece.steps && piece.facing) treads(pen, piece.steps, piece.facing);
  }
  ctx.restore();
}
