/**
 * What every terrain drawing shares: the pieces on show, their colours in the look (two colours
 * where the view is monochrome), the room's axis a piece lies along, and the soft shadow that
 * what stands casts towards the bottom right, as walls, columns and props do.
 */

import type { CellDir, DungeonTerrain, TerrainKind } from '../../model';
import { glyphWeights, type GlyphPen } from '../glyphPen';
import { mixColours } from '../palette';
import type { RenderEnv } from '../renderEnv';

/** The pieces in rooms the view shows. */
export function shownPieces(env: RenderEnv, kinds?: ReadonlySet<TerrainKind>): DungeonTerrain[] {
  const { dungeon } = env;
  return dungeon.floor.terrain.filter((piece) => dungeon.roomShapes.has(piece.room) && (!kinds || kinds.has(piece.kind)));
}

/** A pen at the glyph family's weights, its outline set as the line width. */
export function terrainPen(env: RenderEnv): GlyphPen {
  const { outline, fine } = glyphWeights(env);
  const { ctx, palette } = env;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = outline;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { ctx, palette, fine };
}

export interface TerrainColours {
  /** The top of something raised: the floor lifted towards the fill. */
  raised: string;
  /** A shade of the floor for depth. */
  shade: string;
  /** Deep shade, the bottom of what is far down. */
  deep: string;
  lava: string;
  acid: string;
  /** Deep water: the water darkened. */
  deepWater: string;
}

/** Terrain's colours in the look; monochrome keeps to ink and the other colour. */
export function terrainColours(env: RenderEnv): TerrainColours {
  const { palette, view } = env;
  if (view.monochrome) {
    return { raised: palette.fill, shade: palette.floor, deep: palette.ink, lava: palette.floor, acid: palette.floor, deepWater: palette.floor };
  }
  return {
    raised: mixColours(palette.floor, palette.fill, 0.55),
    shade: mixColours(palette.floor, palette.ink, 0.25),
    deep: mixColours(palette.floor, palette.ink, 0.72),
    lava: mixColours('#d2532a', palette.floor, 0.15),
    acid: mixColours('#8fb03a', palette.floor, 0.2),
    deepWater: mixColours(palette.water, palette.ink, 0.3),
  };
}

/** The axis of the piece's room: the way it was entered. */
export function roomAxis(env: RenderEnv, piece: DungeonTerrain): CellDir {
  return env.dungeon.floor.rooms[piece.room]?.axis ?? { x: 0, y: 1 };
}

/**
 * The soft shadow of whatever `trace` adds to the path, cast towards the bottom right and `lift`
 * as long as a column's. The caller draws the thing itself over it.
 */
export function castShadow(env: RenderEnv, lift: number, trace: () => void): void {
  const { ctx, palette } = env;
  if (!palette.shadow || lift <= 0) return;
  const { a, b, c, d } = ctx.getTransform();
  // Shadow offset and blur are in device pixels, outside the context's transform.
  const distance = env.style.shadow.distance * lift * Math.sqrt(Math.abs(a * d - b * c));
  ctx.save();
  ctx.beginPath();
  trace();
  ctx.globalCompositeOperation = 'multiply';
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = distance * 1.2;
  ctx.shadowOffsetX = distance * 0.75;
  ctx.shadowOffsetY = distance * 0.75;
  ctx.fillStyle = palette.shadow;
  ctx.fill();
  ctx.restore();
}

/** A small seeded stream per piece, so a piece's details never move when another changes. */
export function pieceRng(env: RenderEnv, piece: DungeonTerrain): () => number {
  return env.rng(`terrain:${piece.id}`);
}
