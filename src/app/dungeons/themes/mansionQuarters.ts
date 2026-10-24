/** The Haunted Mansion's private rooms, attics, study, laboratory, observatory, gallery, ritual room, landings and ruins (`mansionRooms.ts`). */

import type { RoomTypeSpec } from './themeTypes';

export const MANSION_QUARTERS: readonly RoomTypeSpec[] = [
  {
    id: 'study',
    count: [0, 1],
    size: 'small',
    depth: ['middle', 'deep'],
    degree: 'dead-end',
    near: ['library'],
    terrain: {},
    furnish: {
      defining: { kind: 'desk', verb: 'wall' },
      with: { kind: 'chair', verb: 'withParent', parent: 'desk' },
      pieces: [
        { kind: 'bookshelf', verb: 'wall', chance: 0.7 },
        { kind: 'cabinet', verb: 'corner', chance: 0.5 },
      ],
    },
  },
  {
    id: 'master-bedroom',
    count: [1, 1],
    required: true,
    size: 'medium',
    depth: 'deepest',
    degree: 'dead-end',
    floor: 'last',
    apart: ['kitchen'],
    terrain: {},
    furnish: {
      defining: { kind: 'four-poster-bed', verb: 'wall' },
      with: { kind: 'chest', verb: 'withParent', parent: 'four-poster-bed' },
      pieces: [
        { kind: 'wardrobe', verb: 'wall', chance: 0.8 },
        { kind: 'dressing-table', verb: 'wall', chance: 0.6 },
        { kind: 'hearth', verb: 'wall', chance: 0.6 },
      ],
    },
  },
  {
    id: 'bedroom',
    count: [1, 4],
    size: 'small',
    depth: 'deep',
    floor: 'beyond',
    terrain: {},
    furnish: {
      defining: { kind: 'bed', verb: 'wall' },
      pieces: [
        { kind: 'wardrobe', verb: 'wall', chance: 0.6 },
        { kind: 'washstand', verb: 'wall', chance: 0.5 },
      ],
    },
  },
  {
    id: 'nursery',
    count: [0, 1],
    size: 'small',
    depth: 'deep',
    degree: 'dead-end',
    floor: 'beyond',
    near: ['master-bedroom'],
    terrain: {},
    furnish: {
      defining: { kind: 'bed', verb: 'wall', count: [1, 2] },
      pieces: [
        { kind: 'chest', verb: 'corner', chance: 0.6 },
        { kind: 'rocking-chair', verb: 'corner', chance: 0.6 },
        { kind: 'dust-sheet', verb: 'centre', chance: 0.5 },
      ],
    },
  },
  {
    id: 'bathroom',
    count: [0, 2],
    size: 'tiny',
    smallest: true,
    degree: 'dead-end',
    floor: 'beyond',
    next: ['bedroom', 'master-bedroom'],
    terrain: {},
    furnish: {
      defining: { kind: 'bathtub', verb: 'wall' },
      pieces: [{ kind: 'washstand', verb: 'wall', chance: 0.6 }],
    },
  },
  {
    id: 'attic-room',
    count: [0, 3],
    size: 'small',
    floor: 'last',
    mayStandEmpty: true,
    terrain: {},
    furnish: {
      defining: { kind: 'cot', verb: 'wall', count: [1, 3] },
      pieces: [
        { kind: 'chest', verb: 'corner', chance: 0.6 },
        { kind: 'dust-sheet', verb: 'centre', count: [1, 3], chance: 0.7 },
      ],
    },
  },
  {
    id: 'laboratory',
    count: [0, 1],
    size: ['small', 'medium'],
    depth: 'deep',
    degree: 'dead-end',
    floor: 'beyond',
    terrain: { allows: ['mosaic'] },
    furnish: {
      defining: { kind: 'alembic-table', verb: 'centre' },
      pieces: [
        { kind: 'workbench', verb: 'wall', chance: 0.7 },
        { kind: 'shelves', verb: 'wall', chance: 0.6 },
      ],
    },
  },
  {
    id: 'observatory',
    count: [0, 1],
    size: 'small',
    depth: 'deepest',
    degree: 'dead-end',
    floor: 'last',
    terrain: {},
    furnish: {
      defining: { kind: 'telescope', verb: 'centre' },
      pieces: [{ kind: 'star-chart', verb: 'wall', chance: 0.7 }],
    },
  },
  {
    id: 'portrait-gallery',
    count: [0, 1],
    shape: 'long',
    depth: 'middle',
    degree: 'through',
    terrain: {},
    furnish: {
      defining: { kind: 'portrait', verb: 'wall', count: [3, 8] },
      pieces: [
        { kind: 'bust', verb: 'wall', count: [2, 4], chance: 0.5 },
        { kind: 'bench', verb: 'wall', chance: 0.5 },
      ],
    },
  },
  {
    // The summoning circle is its mosaic (terrain); candle stands stand about it.
    id: 'ritual-room',
    count: [0, 1],
    climaxOnly: true,
    size: 'medium',
    depth: 'deepest',
    degree: 'dead-end',
    floor: 'last',
    terrain: { allows: ['mosaic', 'platform'] },
    furnish: { pieces: [{ kind: 'candle-stand', verb: 'flank', count: [1, 2] }] },
  },
  {
    id: 'landing',
    count: [0, 64],
    holdsStairs: true,
    mayStandEmpty: true,
    terrain: { features: ['light-well'], holes: ['gallery'] },
    furnish: {
      pieces: [
        { kind: 'rug', verb: 'centre', chance: 0.4 },
        { kind: 'portrait', verb: 'wall', chance: 0.4 },
        { kind: 'side-table', verb: 'wall', chance: 0.3 },
      ],
    },
  },
  {
    id: 'collapsed-room',
    count: [0, 2],
    size: 'medium',
    ruinedOnly: true,
    terrain: { features: ['rotted-floor'], hazards: ['chasm'], allows: ['rubble-heap', 'rubble-field', 'broken-floor'] },
    furnish: { pieces: [] },
  },
];
