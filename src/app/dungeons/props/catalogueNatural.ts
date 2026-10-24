/**
 * The Cavern's rows of the furniture catalogue: formations nature built (`natural`, kept by a
 * hazard room) and what those who live in caves put down. Spread into `PROP_SPECS`.
 */

import type { PropSpec } from './catalogue';
import type { PropKind } from './propKinds';

type CavernKind = Extract<PropKind, 'stalagmites' | 'column-formation' | 'flowstone' | 'curtain' | 'crystals' | 'mushrooms' | 'boulder' | 'nest' | 'campfire' | 'bedroll' | 'crude-table' | 'pen'>;

export const CAVERN_PROP_SPECS: Readonly<Record<CavernKind, PropSpec>> = {
  stalagmites: { footprint: { along: 1, out: 1 }, wall: 'free', clear: 'none', cover: 'half', footing: 'block', natural: true },
  'column-formation': { footprint: { along: 1, out: 1 }, wall: 'free', clear: 'none', cover: 'total', footing: 'block', natural: true },
  flowstone: { footprint: { along: 1, out: 0 }, stretch: 3, wall: 'back', clear: 'none', wallPiece: true, natural: true },
  curtain: { footprint: { along: 1, out: 0 }, stretch: 2, wall: 'back', clear: 'none', wallPiece: true, natural: true },
  // Against a wall or at a pool's edge (the shore verb).
  crystals: { footprint: { along: 1, out: 1 }, wall: 'back', clear: 'front', cover: 'half', footing: 'block', natural: true },
  mushrooms: { footprint: { along: 1, out: 1 }, wall: 'free', clear: 'none', footing: 'walk', natural: true },
  boulder: { footprint: { along: 1, out: 1 }, wall: 'free', clear: 'none', cover: 'half', footing: 'block', natural: true },
  nest: { footprint: { along: 2, out: 2 }, wall: 'free', clear: 'ring', footing: 'walk' },
  campfire: { footprint: { along: 1, out: 1 }, wall: 'free', clear: 'ring', footing: 'block' },
  bedroll: { footprint: { along: 1, out: 2 }, wall: 'head', clear: 'sides', footing: 'walk' },
  'crude-table': { footprint: { along: 2, out: 1 }, wall: 'free', clear: 'ring', cover: 'half', footing: 'block' },
  pen: { footprint: { along: 2, out: 2 }, stretch: 3, wall: 'back', clear: 'gate', cover: 'half', footing: 'block' },
};
