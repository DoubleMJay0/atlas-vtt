import { drawGlyph } from './glyph';
import type { Hand } from './hand';
import { propGlyph } from './propGlyphs';

/** The props of the rooms on show, where the view shows them, each in the hand's finish. */
export function drawProps(hand: Hand, water: string, cloth: string): void {
  const { dungeon, view } = hand.scene.env;
  if (!view.props) return;
  for (const prop of dungeon.floor.props) {
    const glyph = propGlyph(prop.kind);
    if (!glyph || !dungeon.roomShapes.has(prop.room)) continue;
    drawGlyph(hand, prop, glyph, water, cloth);
  }
}
