/**
 * The rooms of a Fortress (castle, keep, prison): what each is for, where it stands, its terrain
 * and its furniture. From the report's §2.1, §3.2 and §3.3; the plan's Fortress table. The halls,
 * service and guard rooms are here, the chapel, private rooms, stores and the rest in `fortressQuarters.ts`.
 */

import { FORTRESS_QUARTERS } from './fortressQuarters';
import type { RoomTypeSpec } from './themeTypes';

export const FORTRESS_ROOMS: readonly RoomTypeSpec[] = [
  {
    id: 'gatehouse',
    count: [1, 1],
    depth: 'front',
    degree: 'through',
    floor: 'entrance',
    near: ['barracks', 'armoury'],
    terrain: { features: ['murder-holes'], allows: ['low-wall'] },
    furnish: {
      defining: { kind: 'weapon-rack', verb: 'wall' },
      pieces: [
        { kind: 'bench', verb: 'wall', chance: 0.7 },
        { kind: 'table', verb: 'centre', chance: 0.6 },
        { kind: 'stool', verb: 'withParent', parent: 'table', count: [2, 4] },
        { kind: 'brazier', verb: 'centre', chance: 0.5 },
      ],
    },
  },
  {
    id: 'antechamber',
    count: [0, 1],
    depth: 'front',
    degree: 'through',
    floor: 'entrance',
    next: ['gatehouse', 'great-hall'],
    terrain: {},
    furnish: {
      defining: { kind: 'bench', verb: 'wall' },
      pieces: [
        { kind: 'statue', verb: 'flank', of: 'door', chance: 0.7 },
        { kind: 'tapestry', verb: 'wall', chance: 0.5 },
      ],
    },
  },
  {
    id: 'great-hall',
    count: [1, 1],
    size: 'largest',
    depth: ['front', 'middle'],
    degree: 'hub',
    floor: 'entrance',
    terrain: { features: ['minstrels-gallery'], allows: ['platform', 'pillar'], columns: true },
    furnish: {
      defining: { kind: 'dais', verb: 'backWall' },
      with: { kind: 'high-table', verb: 'backWall' },
      pieces: [
        { kind: 'long-table', verb: 'rows', count: [1, 3] },
        { kind: 'bench', verb: 'withParent', parent: 'long-table', count: [2, 2] },
        { kind: 'hearth', verb: 'wall', chance: 0.8 },
        { kind: 'tapestry', verb: 'wall', chance: 0.6 },
      ],
    },
  },
  {
    id: 'lower-hall',
    count: [0, 1],
    size: 'large',
    depth: 'front',
    degree: 'hub',
    floor: 'entrance',
    terrain: { columns: true },
    furnish: {
      defining: { kind: 'long-table', verb: 'rows', count: [1, 2] },
      pieces: [
        { kind: 'bench', verb: 'withParent', parent: 'long-table', count: [2, 2] },
        { kind: 'hearth', verb: 'wall', chance: 0.6 },
      ],
    },
  },
  {
    id: 'throne-room',
    count: [0, 1],
    climaxOnly: true,
    depth: 'deepest',
    degree: 'dead-end',
    floor: 'last',
    terrain: { allows: ['platform', 'pillar', 'statue'] },
    furnish: {
      defining: { kind: 'dais', verb: 'backWall' },
      with: { kind: 'throne', verb: 'backWall' },
      pieces: [
        { kind: 'tapestry', verb: 'wall', chance: 0.8 },
        { kind: 'statue', verb: 'flank', chance: 0.6 },
        { kind: 'rug', verb: 'centre', chance: 0.6 },
      ],
    },
  },
  {
    id: 'kitchen',
    count: [1, 1],
    required: true,
    depth: ['front', 'middle'],
    floor: 'entrance',
    next: ['great-hall', 'lower-hall'],
    apart: ['chapel', 'solar', 'garderobe'],
    terrain: {},
    furnish: {
      defining: { kind: 'range', verb: 'wall' },
      pieces: [
        { kind: 'work-table', verb: 'centre' },
        { kind: 'barrel', verb: 'corner', chance: 0.7 },
        { kind: 'shelves', verb: 'wall', chance: 0.5 },
      ],
    },
  },
  {
    id: 'buttery',
    count: [1, 2],
    size: 'small',
    degree: 'dead-end',
    floor: 'entrance',
    next: ['kitchen'],
    nextRule: 'any',
    terrain: { features: ['flooded-cellar'], water: 'shallow' },
    furnish: {
      defining: { kind: 'shelves', verb: 'wall' },
      pieces: [
        { kind: 'barrel', verb: 'rows', count: [2, 4], chance: 0.8 },
        { kind: 'crate', verb: 'corner', chance: 0.6 },
      ],
    },
  },
  {
    id: 'storeroom',
    count: [1, 3],
    size: 'small',
    degree: 'dead-end',
    floor: 'entrance',
    mayStandEmpty: true,
    terrain: { features: ['flooded-cellar'], water: 'shallow' },
    furnish: {
      defining: { kind: 'crate', verb: 'corner' },
      pieces: [
        { kind: 'barrel', verb: 'corner', chance: 0.6 },
        { kind: 'sacks', verb: 'corner', chance: 0.6 },
      ],
    },
  },
  {
    id: 'barracks',
    count: [1, 2],
    size: 'medium',
    depth: 'front',
    floor: 'entrance',
    near: ['gatehouse'],
    nearRule: true,
    terrain: {},
    furnish: {
      defining: { kind: 'bunk', verb: 'rows', count: [2, 6] },
      pieces: [
        { kind: 'chest', verb: 'withParent', parent: 'bunk', chance: 0.5 },
        { kind: 'table', verb: 'centre', chance: 0.6 },
        { kind: 'stool', verb: 'withParent', parent: 'table', count: [2, 4] },
        { kind: 'weapon-rack', verb: 'wall', chance: 0.7 },
      ],
    },
  },
  {
    id: 'armoury',
    count: [0, 1],
    size: 'small',
    depth: 'front',
    degree: 'dead-end',
    floor: 'entrance',
    near: ['gatehouse'],
    nearRule: true,
    terrain: {},
    furnish: {
      defining: { kind: 'weapon-rack', verb: 'wall', count: [1, 2] },
      pieces: [
        { kind: 'armour-stand', verb: 'grid', count: [2, 4] },
        { kind: 'workbench', verb: 'wall', chance: 0.5 },
      ],
    },
  },
  ...FORTRESS_QUARTERS,
];
