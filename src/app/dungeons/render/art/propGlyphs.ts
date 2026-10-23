import type { PropKind } from '../../model';
import { drawPropShape, propSilhouette } from '../propShapes';
import type { GlyphDrawing } from './glyph';
import type { Material } from './hand';

/** What each prop is made of, and about half its size in cells (how far the light's modelling reaches across it). */
const PROPS: Record<PropKind, { material: Material; radius: number; dome?: boolean }> = {
  barrel: { material: 'wood', radius: 0.27, dome: true },
  crate: { material: 'wood', radius: 0.3 },
  chest: { material: 'wood', radius: 0.38 },
  throne: { material: 'wood', radius: 0.34 },
  tapestry: { material: 'cloth', radius: 0.4 },
  fountain: { material: 'stone', radius: 0.5, dome: true },
  well: { material: 'stone', radius: 0.4, dome: true },
  statue: { material: 'dressed', radius: 0.3 },
  sarcophagus: { material: 'stone', radius: 0.48 },
  altar: { material: 'stone', radius: 0.44 },
  dais: { material: 'dressed', radius: 1.4 },
};

/** A prop of the glyph family as a drawing a hand can finish. */
export function propGlyph(kind: PropKind): GlyphDrawing {
  const silhouette = propSilhouette(kind);
  const tracer = silhouette ? (path: CanvasPath): void => silhouette(path as CanvasRenderingContext2D) : undefined;
  return { ...PROPS[kind], draw: pen => drawPropShape(kind, pen), ...(tracer && { silhouette: tracer }) };
}
