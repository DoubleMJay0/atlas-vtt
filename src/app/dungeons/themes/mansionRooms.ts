/**
 * The rooms of a Haunted Mansion: what each is for, where it stands, its terrain and its
 * furniture. From the report's §2.2 and §3.2 Manor; the plan's Mansion table. The entrance hall,
 * reception rooms and service wing are here, the private rooms, attics and the rest in
 * `mansionQuarters.ts`. No room takes a hazard.
 */

import { MANSION_QUARTERS } from './mansionQuarters';
import type { RoomTypeSpec } from './themeTypes';

export const MANSION_ROOMS: readonly RoomTypeSpec[] = [
  {
    id: 'entrance-hall',
    count: [1, 1],
    size: 'large',
    depth: 'front',
    degree: 'hub',
    floor: 'entrance',
    terrain: { columns: true },
    furnish: {
      defining: { kind: 'rug', verb: 'centre' },
      pieces: [
        { kind: 'side-table', verb: 'flank', of: 'door', chance: 0.7 },
        { kind: 'coat-stand', verb: 'corner', chance: 0.5 },
        { kind: 'portrait', verb: 'wall', chance: 0.6 },
      ],
    },
  },
  {
    id: 'drawing-room',
    count: [1, 1],
    required: true,
    size: 'medium',
    depth: ['front', 'middle'],
    floor: 'entrance',
    near: ['entrance-hall'],
    apart: ['kitchen'],
    terrain: {},
    furnish: {
      defining: { kind: 'low-table', verb: 'centre' },
      with: { kind: 'sofa', verb: 'withParent', parent: 'low-table' },
      pieces: [
        { kind: 'armchair', verb: 'withParent', parent: 'low-table', count: [2, 2] },
        { kind: 'hearth', verb: 'wall', chance: 0.8 },
        { kind: 'piano', verb: 'corner', chance: 0.4 },
        { kind: 'cabinet', verb: 'wall', chance: 0.5 },
        { kind: 'portrait', verb: 'wall', chance: 0.5 },
      ],
    },
  },
  {
    id: 'dining-room',
    count: [1, 1],
    required: true,
    size: 'medium',
    shape: 'long',
    depth: ['front', 'middle'],
    floor: 'entrance',
    next: ['servery'],
    near: ['kitchen'],
    terrain: {},
    furnish: {
      defining: { kind: 'long-table', verb: 'rows' },
      with: { kind: 'chair', verb: 'withParent', parent: 'long-table', count: [4, 10] },
      pieces: [
        { kind: 'sideboard', verb: 'wall', chance: 0.7 },
        { kind: 'hearth', verb: 'wall', chance: 0.5 },
        { kind: 'portrait', verb: 'wall', chance: 0.5 },
      ],
    },
  },
  {
    id: 'servery',
    count: [0, 1],
    size: 'small',
    degree: 'through',
    floor: 'entrance',
    next: ['kitchen', 'dining-room'],
    terrain: {},
    furnish: {
      defining: { kind: 'shelves', verb: 'wall' },
      pieces: [
        { kind: 'cabinet', verb: 'wall', chance: 0.6 },
        { kind: 'table', verb: 'centre', chance: 0.4 },
      ],
    },
  },
  {
    id: 'kitchen',
    count: [1, 1],
    required: true,
    floor: 'entrance',
    apart: ['drawing-room', 'master-bedroom'],
    terrain: {},
    furnish: {
      defining: { kind: 'range', verb: 'wall' },
      pieces: [
        { kind: 'work-table', verb: 'centre' },
        { kind: 'dresser', verb: 'wall', chance: 0.7 },
        { kind: 'sink', verb: 'wall', chance: 0.6 },
      ],
    },
  },
  {
    id: 'scullery',
    count: [0, 2],
    size: 'small',
    degree: 'dead-end',
    floor: 'entrance',
    next: ['kitchen'],
    terrain: { water: 'shallow' },
    furnish: {
      defining: { kind: 'sink', verb: 'wall' },
      pieces: [
        { kind: 'shelves', verb: 'wall', chance: 0.6 },
        { kind: 'barrel', verb: 'corner', chance: 0.5 },
        { kind: 'crate', verb: 'corner', chance: 0.5 },
      ],
    },
  },
  {
    id: 'servants-hall',
    count: [0, 1],
    size: 'medium',
    floor: 'entrance',
    near: ['kitchen'],
    terrain: {},
    furnish: {
      defining: { kind: 'long-table', verb: 'rows' },
      with: { kind: 'bench', verb: 'withParent', parent: 'long-table', count: [2, 2] },
      pieces: [],
    },
  },
  {
    id: 'wine-cellar',
    count: [0, 1],
    size: 'small',
    degree: 'dead-end',
    floor: 'entrance',
    terrain: { water: 'shallow' },
    furnish: {
      defining: { kind: 'barrel-rack', verb: 'rows' },
      pieces: [{ kind: 'bottle-rack', verb: 'wall', chance: 0.7 }],
    },
  },
  {
    id: 'laundry',
    count: [0, 1],
    size: 'small',
    degree: 'dead-end',
    floor: 'entrance',
    terrain: { water: 'shallow' },
    furnish: {
      defining: { kind: 'wash-tub', verb: 'centre', count: [1, 2] },
      pieces: [
        { kind: 'drying-line', verb: 'wall', chance: 0.7 },
        { kind: 'table', verb: 'wall', chance: 0.4 },
      ],
    },
  },
  {
    id: 'library',
    count: [0, 1],
    size: 'medium',
    depth: 'middle',
    terrain: {},
    furnish: {
      defining: { kind: 'bookshelf', verb: 'wall', count: [2, 6] },
      pieces: [
        { kind: 'table', verb: 'centre', chance: 0.7 },
        { kind: 'armchair', verb: 'corner', chance: 0.5 },
      ],
    },
  },
  {
    id: 'ballroom',
    count: [0, 1],
    size: 'largest',
    depth: 'middle',
    degree: ['through', 'hub'],
    floor: 'entrance',
    terrain: { columns: true, allows: ['platform'] },
    furnish: {
      defining: { kind: 'bust', verb: 'wall', count: [2, 6] },
      pieces: [
        { kind: 'hearth', verb: 'wall', chance: 0.6 },
        { kind: 'piano', verb: 'corner', chance: 0.5 },
      ],
    },
  },
  {
    id: 'conservatory',
    count: [0, 1],
    size: 'medium',
    floor: 'entrance',
    outerWall: true,
    terrain: { water: 'pool', allows: ['pool', 'thicket'] },
    furnish: {
      defining: { kind: 'planter', verb: 'grid', count: [2, 6] },
      pieces: [{ kind: 'fountain', verb: 'centre', chance: 0.5 }],
    },
  },
  ...MANSION_QUARTERS,
];
