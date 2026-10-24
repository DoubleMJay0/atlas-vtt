/**
 * Why a terrain feature exists. Every hole, pit, shaft, chasm, gallery and liquid of a themed room
 * is placed only for one of its room type's reasons (`RoomTerrain.features`), and the reason
 * decides what it may be, where it is cut and how it is shaped: a builder's opening is straight and
 * follows the walls, a natural or broken one is irregular and never a plain square.
 */

import type { TerrainKind } from '../model';

export type FeatureReason =
  | 'minstrels-gallery'
  | 'murder-holes'
  | 'oubliette'
  | 'cistern'
  | 'collapse'
  | 'stair-well'
  | 'ballroom-gallery'
  | 'light-well'
  | 'rotted-floor'
  | 'conservatory-pool'
  | 'flooded-cellar'
  | 'fault-chasm'
  | 'sinkhole'
  | 'pitch'
  | 'cave-lake'
  | 'cave-stream'
  | 'sump'
  | 'lava-flow'
  | 'sulphur-spring';

export interface FeatureSpec {
  /** The terrain the reason may lay. */
  kinds: readonly TerrainKind[];
  /** The standing water it brings, which the water pass lays. */
  water?: 'pool' | 'shallow';
  /** Built: straight edges along the walls. Natural: an irregular, broken outline. */
  shape: 'built' | 'natural';
  /** In the room's own floor, or cut in the floor above it, over the room (a gallery overlooking a hall). */
  at: 'here' | 'above';
  ruinedOnly?: true;
  /** Only on a floor with another below it to open onto. */
  upperFloor?: true;
}

export const FEATURES: Readonly<Record<FeatureReason, FeatureSpec>> = {
  // An upper floor's opening overlooking the great hall, behind a balustrade.
  'minstrels-gallery': { kinds: ['gallery'], shape: 'built', at: 'above' },
  // Small holes in a row over the gate passage.
  'murder-holes': { kinds: ['shaft'], shape: 'built', at: 'above' },
  // One shaft in the gaol, under a grate.
  oubliette: { kinds: ['pit'], shape: 'built', at: 'here' },
  cistern: { kinds: ['deep-water'], water: 'pool', shape: 'built', at: 'here' },
  collapse: { kinds: ['chasm', 'rubble-heap', 'rubble-field', 'broken-floor'], shape: 'natural', at: 'here', ruinedOnly: true },
  // The entrance hall's open stair well.
  'stair-well': { kinds: ['gallery'], shape: 'built', at: 'above' },
  'ballroom-gallery': { kinds: ['gallery'], shape: 'built', at: 'above' },
  'light-well': { kinds: ['gallery'], shape: 'built', at: 'here', upperFloor: true },
  'rotted-floor': { kinds: ['broken-floor', 'chasm'], shape: 'natural', at: 'here', ruinedOnly: true },
  'conservatory-pool': { kinds: ['pool'], water: 'pool', shape: 'built', at: 'here' },
  'flooded-cellar': { kinds: [], water: 'shallow', shape: 'natural', at: 'here', ruinedOnly: true },
  // A cave's, as its geology decides them: a chasm along a fault, a collapse opening onto the floor below, a natural shaft.
  'fault-chasm': { kinds: ['chasm'], shape: 'natural', at: 'here' },
  sinkhole: { kinds: ['chasm'], shape: 'natural', at: 'here', upperFloor: true },
  pitch: { kinds: ['shaft'], shape: 'natural', at: 'here', upperFloor: true },
  // Water where it gathers: a lake in a low chamber, a stream running down to it, a sump at a stream's low end.
  'cave-lake': { kinds: ['deep-water'], shape: 'natural', at: 'here' },
  'cave-stream': { kinds: ['channel'], shape: 'natural', at: 'here' },
  sump: { kinds: ['deep-water'], shape: 'natural', at: 'here' },
  // Lava running deep down a tube, acid rising at a spring on a fault.
  'lava-flow': { kinds: ['channel'], shape: 'natural', at: 'here' },
  'sulphur-spring': { kinds: ['channel', 'deep-water'], shape: 'natural', at: 'here' },
};
