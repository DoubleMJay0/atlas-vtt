import type { FamilyGlyphs } from '../../propShapes';
import * as stone from './stone';
import * as engraved from './engraved';
import { HEARTH, partPath } from './shapes';

/** Each glyph receives its base material's final grain pass over the shared silhouette. */
export const GLYPHS: FamilyGlyphs = {
  hearth: { material: 'dressed', radius: 0.9, lift: 0.7, silhouette: partPath(HEARTH), stone: stone.hearth, engraved: engraved.hearth },
};
