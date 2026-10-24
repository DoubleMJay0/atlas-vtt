/**
 * The kinds of furniture and terrain the generator may put on a map: those with a drawing. A kind
 * the catalogue knows but no painter draws yet is never offered, so no map shows a gap or a
 * stand-in. Unit tests hold each set equal to its drawing registry (`drawnPropKinds()` in
 * `render/propShapes.ts`, `drawnTerrainKinds()` in `render/terrain/drawTerrain.ts`); kinds still
 * waiting are listed in `tests/unit/dungeons/awaitingDrawings.json`, which `npm run preflight`
 * holds empty. Furniture is drawn by family: each family's `kinds.ts` lists what it draws, and
 * only those lists are read here, so the generator never loads a drawing.
 */

import type { TerrainKind } from './model';
import type { PropKind } from './props/propKinds';
import { KINDS as BEDS } from './render/props/beds/kinds';
import { KINDS as CHAMBERS } from './render/props/chambers/kinds';
import { KINDS as DRESSING } from './render/props/dressing/kinds';
import { KINDS as FORMATIONS } from './render/props/formations/kinds';
import { KINDS as FORTRESS } from './render/props/fortress/kinds';
import { KINDS as HEARTH } from './render/props/hearth/kinds';
import { KINDS as LIVED_IN } from './render/props/livedIn/kinds';
import { KINDS as PARLOUR } from './render/props/parlour/kinds';
import { KINDS as SEATING } from './render/props/seating/kinds';
import { KINDS as SHELVES } from './render/props/shelves/kinds';

/** The eleven props of the first generator, drawn in `render/propWood.ts` and `render/propStone.ts`. */
export const FIRST_PROP_KINDS: readonly PropKind[] = [
  'dais',
  'throne',
  'altar',
  'statue',
  'fountain',
  'well',
  'sarcophagus',
  'tapestry',
  'chest',
  'crate',
  'barrel',
];

export const DRAWN_PROP_KINDS: ReadonlySet<PropKind> = new Set<PropKind>([
  ...FIRST_PROP_KINDS,
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
]);

export const DRAWN_TERRAIN_KINDS: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  'low-wall',
  'crates',
  'table',
  'altar',
  'sarcophagus',
  'rubble-heap',
  'pillar',
  'statue',
  'wall-fragment',
  'obelisk',
  'pews',
  'rubble-field',
  'broken-floor',
  'shallow-water',
  'brambles',
  'thicket',
  'tangled-roots',
  'chasm-floor',
  'chasm',
  'shaft',
  'channel',
  'deep-water',
  'pit',
  'gallery',
  'bridge',
  'platform',
  'ledge',
  'mosaic',
  'pool',
  'portal-ring',
]);
