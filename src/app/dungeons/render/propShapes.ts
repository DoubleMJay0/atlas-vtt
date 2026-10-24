import type { PropKind } from '../model';
import type { GlyphPen } from './glyphPen';
import { STONE_AND_WATER } from './propStone';
import { WOOD_AND_CLOTH } from './propWood';

/**
 * Atlas' own drawings of the props, one family in the grammar of `glyphPen.ts`: in cells around
 * the prop's centre, its front towards −y (into the room; a tapestry's and a dais' back is the
 * wall, at +y). Stone is bevelled, wood shows its grain or bands, water lies in its basin.
 */
export type PropPen = GlyphPen;

/** One prop's drawing, in cells around its centre, its front towards −y. */
export interface PropGlyph {
  draw: (pen: PropPen) => void;
  /** The outline that casts the prop's shadow; none for what lies flat. */
  silhouette?: (ctx: PropPen['ctx']) => void;
  /** How tall it stands, as a share of a column's shadow. */
  lift: number;
}

/** The kinds that have a drawing; the generator offers no other (`drawnKinds.ts`). */
const GLYPHS: Partial<Record<PropKind, PropGlyph>> = { ...WOOD_AND_CLOTH, ...STONE_AND_WATER };

/** Every kind with a drawing. */
export function drawnPropKinds(): PropKind[] {
  return Object.keys(GLYPHS) as PropKind[];
}

/** Draws one prop at the origin; the caller has moved, turned and scaled the context and set the ink and outline width. */
export function drawPropShape(kind: PropKind, pen: PropPen): void {
  GLYPHS[kind]?.draw(pen);
}

/** Traces the outline that casts a prop's shadow onto the current path; false for a prop that lies flat or has no drawing. */
export function tracePropSilhouette(kind: PropKind, ctx: PropPen['ctx']): boolean {
  const silhouette = GLYPHS[kind]?.silhouette;
  if (!silhouette) return false;
  silhouette(ctx);
  return true;
}

/** How tall a prop stands, as a share of a column's shadow; 0 for a kind without a drawing. */
export function propLift(kind: PropKind): number {
  return GLYPHS[kind]?.lift ?? 0;
}

/** The outline that casts a prop's shadow, as a tracer; none for a prop that lies flat or has no drawing. */
export function propSilhouette(kind: PropKind): ((ctx: PropPen['ctx']) => void) | undefined {
  return GLYPHS[kind]?.silhouette;
}
