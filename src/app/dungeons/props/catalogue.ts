/**
 * Every kind of furniture described once: how much floor it takes, which side faces a wall, which
 * cells around it stay walkable, whether it hangs on the wall, what cover it gives and whether it
 * can be walked across. Placement (`arrange.ts`, `space.ts`), the scene's features and the
 * room notes read it; nothing else keeps a table per kind.
 */

import type { CoverLevel } from '../model';
import type { Footing } from '../terrain/catalog';
import { CAVERN_PROP_SPECS } from './catalogueNatural';
import type { PropKind } from './propKinds';

/**
 * Which side of a piece meets a wall: its back, its short end (a bed's head), none, a corner, an
 * outer wall, wall to wall or across an alcove, or none of its own (placed around another piece).
 */
export type PropWall = 'back' | 'head' | 'free' | 'corner' | 'outer' | 'across' | 'parent';

/** The cells kept walkable around a piece: the row before it, both long sides, all round, one gate cell, or none. */
export type PropClear = 'front' | 'sides' | 'ring' | 'gate' | 'none';

/** Whole cells along its wall or front and out from it, or a disc of `reach` cells placed below a cell. */
export type Footprint = { along: number; out: number } | { reach: number };

export interface PropSpec {
  footprint: Footprint;
  /** The longest it may be drawn along, in cells. */
  stretch?: number;
  wall: PropWall;
  clear: PropClear;
  /** Hangs on a wall run no door breaks and takes no floor. */
  wallPiece?: true;
  cover?: CoverLevel;
  /** Whether its cells can be walked across; none for a wall piece. */
  footing?: Footing;
  /** A formation nature made, not furniture: a hazard room keeps it. */
  natural?: true;
}

const cells = (along: number, out: number): Footprint => ({ along, out });
const disc = (reach: number): Footprint => ({ reach });

/** Against a wall, its front kept clear: the commonest shape of furniture. */
function backed(along: number, out: number, cover?: CoverLevel): PropSpec {
  return { footprint: cells(along, out), wall: 'back', clear: 'front', footing: 'block', ...(cover && { cover }) };
}

/** Hung on a wall, `along` cells of it. */
function onWall(along: number, wall: PropWall = 'back', clear: PropClear = 'none'): PropSpec {
  return { footprint: cells(along, 0), wall, clear, wallPiece: true };
}

/** A free-standing disc. */
function standing(reach: number, cover?: CoverLevel, wall: PropWall = 'free'): PropSpec {
  return { footprint: disc(reach), wall, clear: 'none', footing: 'block', ...(cover && { cover }) };
}

export const PROP_SPECS: Readonly<Record<PropKind, PropSpec>> = {
  dais: { footprint: disc(1.5), wall: 'back', clear: 'front', footing: 'walk' },
  throne: standing(0.36, 'half'),
  altar: standing(0.42, 'half'),
  statue: standing(0.35, 'total'),
  fountain: standing(0.52, 'half'),
  well: standing(0.42, 'half'),
  sarcophagus: standing(0.45, 'half'),
  tapestry: onWall(1),
  chest: standing(0.42, 'half'),
  crate: standing(0.34, 'half'),
  barrel: standing(0.27, 'half'),
  table: { footprint: cells(2, 1), wall: 'free', clear: 'ring', cover: 'half', footing: 'block' },
  'long-table': { footprint: cells(3, 1), stretch: 6, wall: 'free', clear: 'ring', cover: 'half', footing: 'block' },
  'high-table': backed(3, 1, 'half'),
  // Against a wall alone, or beside a table (with its parent).
  bench: { footprint: cells(2, 1), wall: 'back', clear: 'front', footing: 'walk' },
  chair: { footprint: disc(0.22), wall: 'parent', clear: 'none', footing: 'walk' },
  stool: { footprint: disc(0.18), wall: 'parent', clear: 'none', footing: 'walk' },
  hearth: backed(2, 1),
  range: backed(2, 1, 'half'),
  'work-table': { footprint: cells(2, 1), wall: 'free', clear: 'ring', cover: 'half', footing: 'block' },
  shelves: backed(2, 1, 'half'),
  sacks: standing(0.28, 'half', 'corner'),
  'weapon-rack': backed(2, 1, 'half'),
  'armour-stand': { footprint: cells(1, 1), wall: 'free', clear: 'none', cover: 'half', footing: 'block' },
  workbench: backed(2, 1, 'half'),
  bunk: { footprint: cells(1, 2), wall: 'head', clear: 'sides', cover: 'half', footing: 'block' },
  bed: { footprint: cells(1, 2), wall: 'head', clear: 'sides', cover: 'half', footing: 'block' },
  'four-poster-bed': { footprint: cells(2, 2), wall: 'head', clear: 'sides', cover: 'half', footing: 'block' },
  cot: { footprint: cells(1, 2), wall: 'head', clear: 'sides', footing: 'block' },
  desk: backed(2, 1, 'half'),
  wardrobe: backed(1, 1, 'total'),
  'dressing-table': backed(1, 1, 'half'),
  rug: { footprint: cells(2, 2), stretch: 8, wall: 'free', clear: 'none', footing: 'walk' },
  'candle-stand': standing(0.15, undefined, 'parent'),
  latrine: onWall(1, 'outer', 'front'),
  'cell-bars': { footprint: cells(2, 1), stretch: 4, wall: 'across', clear: 'gate', footing: 'block' },
  stall: backed(1, 2, 'half'),
  trough: backed(2, 1, 'half'),
  hay: { footprint: cells(1, 1), wall: 'corner', clear: 'none', cover: 'half', footing: 'block' },
  bookshelf: backed(2, 1, 'total'),
  bust: { footprint: disc(0.2), wall: 'back', clear: 'front', footing: 'block' },
  portrait: onWall(1),
  brazier: standing(0.25),
  sofa: { footprint: cells(2, 1), wall: 'parent', clear: 'front', cover: 'half', footing: 'block' },
  armchair: { footprint: cells(1, 1), wall: 'parent', clear: 'front', cover: 'half', footing: 'block' },
  'low-table': { footprint: cells(1, 1), wall: 'free', clear: 'ring', footing: 'block' },
  piano: { footprint: cells(2, 2), wall: 'corner', clear: 'front', cover: 'half', footing: 'block' },
  cabinet: backed(1, 1, 'half'),
  sideboard: backed(2, 1, 'half'),
  'side-table': backed(1, 1),
  'coat-stand': standing(0.15, undefined, 'corner'),
  dresser: backed(2, 1, 'half'),
  sink: backed(1, 1, 'half'),
  planter: { footprint: cells(1, 1), wall: 'free', clear: 'none', cover: 'half', footing: 'block' },
  washstand: backed(1, 1),
  bathtub: { footprint: cells(1, 2), wall: 'back', clear: 'sides', cover: 'half', footing: 'block' },
  'rocking-chair': standing(0.25, undefined, 'corner'),
  'barrel-rack': backed(2, 1, 'half'),
  'bottle-rack': backed(2, 1, 'half'),
  'wash-tub': { footprint: cells(1, 1), wall: 'free', clear: 'none', cover: 'half', footing: 'block' },
  // Strung wall to wall, as long as the room is wide.
  'drying-line': onWall(1, 'across'),
  'dust-sheet': { footprint: cells(1, 1), stretch: 2, wall: 'free', clear: 'none', cover: 'half', footing: 'block' },
  'broken-furniture': { footprint: cells(1, 1), wall: 'free', clear: 'none', footing: 'walk' },
  'alembic-table': { footprint: cells(2, 1), wall: 'free', clear: 'ring', cover: 'half', footing: 'block' },
  telescope: { footprint: cells(1, 1), wall: 'free', clear: 'ring', footing: 'block' },
  'star-chart': onWall(1),
  ...CAVERN_PROP_SPECS,
};

/** Whether a piece takes whole cells (a wall piece takes a row of none). */
export function isCellPiece(spec: PropSpec): spec is PropSpec & { footprint: { along: number; out: number } } {
  return 'along' in spec.footprint;
}

/** How far a wall piece reaches off its wall into the room, in cells. */
const WALL_PIECE_REACH = 0.1;

/** How far a piece reaches from its centre, in cells: a disc's radius, a wall piece's depth, else half its shorter side. */
export function propReach(kind: PropKind): number {
  const spec = PROP_SPECS[kind];
  const { footprint } = spec;
  if ('reach' in footprint) return footprint.reach;
  if (spec.wallPiece) return WALL_PIECE_REACH;
  return Math.min(footprint.along, footprint.out) / 2;
}
