import type { GlyphSpecimen } from './types';

const QUARTER = Math.PI / 2;
const KINDS = ['barrel', 'crate', 'chest', 'throne', 'statue', 'fountain', 'well', 'sarcophagus', 'altar', 'tapestry', 'dais'] as const;

/** The eleven first props, the quality every family is held to, as the families' sheets show them. */
export const SPECIMEN: GlyphSpecimen = {
  family: 'reference',
  pieces: KINDS.flatMap(kind => [0, QUARTER].map(rotation => ({ kind, rotation, ...(kind === 'dais' && { against: 'wall' as const }) }))),
  crowded: [
    // A throne on its dais at the wall, and a chest with a barrel and a crate beside it.
    { kind: 'dais', rotation: 0, against: 'wall', at: { x: 1.5, y: 2 } },
    { kind: 'throne', rotation: 0, at: { x: 1.5, y: 1.25 } },
    { kind: 'chest', rotation: 0, at: { x: 4.3, y: 1.55 } },
    { kind: 'barrel', rotation: 0, at: { x: 5.2, y: 1.55 } },
    { kind: 'crate', rotation: 0, at: { x: 4.6, y: 0.85 } },
  ],
};
