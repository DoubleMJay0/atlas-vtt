import type { GlyphPen } from '../../glyphPen';
import { hearthBody } from './cooking';

/** Painted parts carry their own materials, rounded light and quiet depth washes. */
export function hearth(pen: GlyphPen): void { hearthBody(pen, true); }
