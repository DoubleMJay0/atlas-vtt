/** The Fortress's chapel, private quarters, gaol, cistern, stable, library, gallery, stair halls and ruins (`fortressRooms.ts`). */

import type { RoomTypeSpec } from './themeTypes';

export const FORTRESS_QUARTERS: readonly RoomTypeSpec[] = [
  {
    id: 'chapel',
    count: [0, 1],
    depth: 'middle',
    degree: 'dead-end',
    near: ['great-hall', 'solar'],
    apart: ['kitchen'],
    terrain: { allows: ['pews', 'platform'], columns: true },
    furnish: {
      defining: { kind: 'altar', verb: 'backWall' },
      pieces: [{ kind: 'candle-stand', verb: 'flank', chance: 0.8 }],
    },
  },
  {
    id: 'solar',
    count: [1, 1],
    required: true,
    size: 'medium',
    depth: 'deep',
    floor: 'beyond',
    apart: ['kitchen', 'gaol'],
    terrain: {},
    furnish: {
      defining: { kind: 'bed', verb: 'wall' },
      with: { kind: 'chest', verb: 'withParent', parent: 'bed' },
      pieces: [
        { kind: 'hearth', verb: 'wall', chance: 0.8 },
        { kind: 'desk', verb: 'wall', chance: 0.6 },
        { kind: 'chair', verb: 'withParent', parent: 'desk' },
        { kind: 'wardrobe', verb: 'wall', chance: 0.6 },
        { kind: 'rug', verb: 'centre', chance: 0.5 },
      ],
    },
  },
  {
    id: 'chamber',
    count: [0, 2],
    size: 'small',
    depth: 'deep',
    floor: 'beyond',
    near: ['solar'],
    mayStandEmpty: true,
    terrain: {},
    furnish: {
      defining: { kind: 'bed', verb: 'wall' },
      pieces: [
        { kind: 'wardrobe', verb: 'wall', chance: 0.6 },
        { kind: 'dressing-table', verb: 'wall', chance: 0.4 },
      ],
    },
  },
  {
    id: 'garderobe',
    count: [0, 2],
    size: 'tiny',
    degree: 'dead-end',
    floor: 'beyond',
    outerWall: true,
    next: ['solar', 'chamber'],
    apart: ['kitchen'],
    terrain: {},
    furnish: { defining: { kind: 'latrine', verb: 'wall' }, pieces: [] },
  },
  {
    id: 'gaol',
    count: [0, 1],
    size: ['small', 'medium'],
    degree: 'dead-end',
    floor: 'entrance',
    apart: ['solar'],
    terrain: { hazards: ['pit'] },
    furnish: {
      defining: { kind: 'cell-bars', verb: 'backWall' },
      with: { kind: 'cot', verb: 'withParent', parent: 'cell-bars' },
      pieces: [
        { kind: 'desk', verb: 'wall', chance: 0.6 },
        { kind: 'stool', verb: 'withParent', parent: 'desk' },
      ],
    },
  },
  {
    id: 'cistern',
    count: [0, 1],
    size: 'medium',
    shape: 'square',
    degree: 'dead-end',
    floor: 'entrance',
    terrain: { hazards: ['deep-water'], water: 'pool' },
    furnish: { defining: { kind: 'well', verb: 'centre' }, pieces: [] },
  },
  {
    id: 'stable',
    count: [0, 1],
    size: 'medium',
    depth: 'front',
    floor: 'entrance',
    near: ['gatehouse'],
    terrain: {},
    furnish: {
      defining: { kind: 'stall', verb: 'rows', count: [2, 4] },
      pieces: [
        { kind: 'trough', verb: 'wall', chance: 0.7 },
        { kind: 'hay', verb: 'corner', chance: 0.7 },
      ],
    },
  },
  {
    id: 'library',
    count: [0, 1],
    size: 'medium',
    depth: ['middle', 'deep'],
    terrain: {},
    furnish: {
      defining: { kind: 'bookshelf', verb: 'wall', count: [2, 4] },
      pieces: [
        { kind: 'table', verb: 'centre', chance: 0.7 },
        { kind: 'desk', verb: 'wall', chance: 0.5 },
      ],
    },
  },
  {
    id: 'gallery',
    count: [0, 1],
    shape: 'long',
    depth: 'middle',
    degree: 'through',
    terrain: { holes: ['gallery'] },
    furnish: {
      defining: { kind: 'portrait', verb: 'wall', count: [2, 6] },
      pieces: [
        { kind: 'bust', verb: 'wall', count: [2, 4], chance: 0.6 },
        { kind: 'bench', verb: 'wall', chance: 0.5 },
        { kind: 'tapestry', verb: 'wall', chance: 0.4 },
      ],
    },
  },
  {
    id: 'stair-hall',
    count: [0, 64],
    holdsStairs: true,
    mayStandEmpty: true,
    terrain: { holes: ['gallery'] },
    furnish: {
      pieces: [
        { kind: 'bench', verb: 'wall', chance: 0.3 },
        { kind: 'tapestry', verb: 'wall', chance: 0.3 },
      ],
    },
  },
  {
    id: 'collapsed-room',
    count: [0, 2],
    size: 'medium',
    ruinedOnly: true,
    terrain: { hazards: ['chasm'], allows: ['rubble-heap', 'rubble-field', 'broken-floor'] },
    furnish: { pieces: [] },
  },
];
