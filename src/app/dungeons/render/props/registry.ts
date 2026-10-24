import { STONE_AND_WATER } from '../propStone';
import type { FamilyGlyphs } from '../propShapes';
import { WOOD_AND_CLOTH } from '../propWood';
import { GLYPHS as BEDS } from './beds';
import { GLYPHS as CHAMBERS } from './chambers';
import { GLYPHS as DRESSING } from './dressing';
import { GLYPHS as FORMATIONS } from './formations';
import { GLYPHS as FORTRESS } from './fortress';
import { GLYPHS as HEARTH } from './hearth';
import { GLYPHS as LIVED_IN } from './livedIn';
import { GLYPHS as PARLOUR } from './parlour';
import { GLYPHS as SEATING } from './seating';
import { GLYPHS as SHELVES } from './shelves';

/**
 * Every drawn kind of furniture: the eleven first props (`propWood.ts`, `propStone.ts`) and each
 * family's module (`props/<family>/index.ts`), which one drawer owns at a time.
 */
export const PROP_GLYPHS: FamilyGlyphs = {
  ...WOOD_AND_CLOTH,
  ...STONE_AND_WATER,
  ...SEATING,
  ...SHELVES,
  ...HEARTH,
  ...BEDS,
  ...DRESSING,
  ...PARLOUR,
  ...FORMATIONS,
  ...LIVED_IN,
  ...CHAMBERS,
  ...FORTRESS,
};
