/**
 * The kinds of furniture and terrain the generator may put on a map: those with a drawing. A kind
 * the catalogue knows but no painter draws yet is never offered, so no map shows a gap or a
 * stand-in. Unit tests hold each set equal to its drawing registry (`drawnPropKinds()` in
 * `render/propShapes.ts`, `drawnTerrainKinds()` in `render/terrain/drawTerrain.ts`); kinds still
 * waiting are listed in `tests/unit/dungeons/awaitingDrawings.json`, which `npm run preflight`
 * holds empty.
 */

import type { TerrainKind } from './model';
import type { PropKind } from './props/propKinds';

export const DRAWN_PROP_KINDS: ReadonlySet<PropKind> = new Set<PropKind>([
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
