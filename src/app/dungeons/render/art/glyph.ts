import type { GlyphPen } from '../glyphPen';
import type { Hand, Material } from './hand';

/** Where a glyph stands: its centre in cells, its turn and its scale. */
export interface GlyphPlace {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

/** What a glyph is: its drawing, the outline its finish is laid in, and how far that reaches. */
export interface GlyphDrawing {
  material: Material;
  draw: (pen: GlyphPen) => void;
  silhouette?: (path: CanvasPath) => void;
  /** About half the glyph's size, in its own cells: how far the light's modelling reaches across it. */
  radius: number;
}

/**
 * Draws a glyph of the family (`glyphPen.ts`) in a direction's hand: its fills in the material's
 * colours and its outline in the material's ink, then, inside its silhouette, the material's
 * texture and the modelling of the one light, which keeps to the map's frame however it is turned.
 */
export function drawGlyph(hand: Hand, place: GlyphPlace, glyph: GlyphDrawing, water: string, cloth: string): void {
  const { ctx, palette } = hand.scene.env;
  const paint = hand.paint(glyph.material);
  ctx.save();
  ctx.translate(place.x, place.y);
  ctx.rotate(place.rotation);
  ctx.scale(place.scale, place.scale);
  ctx.strokeStyle = paint.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = hand.weight('outline') / place.scale;
  const pen: GlyphPen = { ctx, palette: { ...palette, fill: paint.fill, ink: paint.ink, water }, fine: hand.weight('fine') / place.scale, cloth };
  glyph.draw(pen);
  if (glyph.silhouette) {
    const silhouette = glyph.silhouette;
    hand.grain(path => silhouette(path), glyph.material);
    ctx.beginPath();
    silhouette(ctx);
    ctx.clip();
    // The light stands in the map's frame, not the glyph's.
    ctx.rotate(-place.rotation);
    const r = glyph.radius * 2;
    hand.solid(path => path.rect(-r, -r, r * 2, r * 2), { x: 0, y: 0 }, glyph.radius, 0.9);
  }
  ctx.restore();
}
