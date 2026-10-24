/**
 * How a Cavern's boss room may be furnished as an arena: the grand cavern, perhaps across a fault's
 * chasm; the lake cavern behind its dam; the den round its nest. Never a throne, and no dressed
 * pillars: a cave's cover is its breakdown, never mirrored.
 */

import type { ArenaSpec, ClimaxSpec } from '../themeTypes';

export const GRAND_CAVERN_ARENA: ArenaSpec = { seat: null, setPieces: [], mirrored: ['rubble-heap'], hazards: ['chasm'] };
export const LAKE_ARENA: ArenaSpec = { seat: null, setPieces: [], mirrored: ['rubble-heap'], hazards: ['deep-water'] };
export const DEN_ARENA: ArenaSpec = { seat: 'nest', setPieces: [], mirrored: ['rubble-heap'], hazards: [] };
export const CHIEF_DEN_ARENA: ArenaSpec = { seat: 'bedroll', setPieces: [], mirrored: ['rubble-heap'], hazards: [] };

export const CAVERN_CLIMAX: readonly ClimaxSpec[] = [
  { type: 'grand-cavern', weight: 0.45, arena: GRAND_CAVERN_ARENA },
  { type: 'lake-cavern', weight: 0.25, arena: LAKE_ARENA },
  // A beast's den in a wild cave, its chief's in a lived-in one: the facts allow one of the two, never both.
  { type: 'den', weight: 0.3, arena: DEN_ARENA },
  { type: 'chief-den', weight: 0.3, arena: CHIEF_DEN_ARENA },
];
