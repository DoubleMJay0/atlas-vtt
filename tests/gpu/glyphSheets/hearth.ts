import type { GlyphSpecimen } from './types';

/** A cold fireplace built into a wall, turned both ways, and two of them along one wall. */
export const SPECIMEN: GlyphSpecimen = {
  family: 'hearth',
  pieces: [0, Math.PI / 2].map(rotation => ({ kind: 'hearth', rotation, against: 'wall' as const })),
  // Cell pieces use their actual row: marking them against a wall discards at.y when the harness calculates group depth.
  crowded: [
    { kind: 'hearth', rotation: 0, at: { x: 0, y: 1 } },
    { kind: 'hearth', rotation: 0, at: { x: 3, y: 1 } },
  ],
};
