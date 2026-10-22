/**
 * A generated dungeon, in grid cells (x right, y down). The first entrance door sits at (0, 0).
 * Everything a renderer, the scene writer and the note writer need, and nothing they derive.
 */

/** Bump when the same seed and tags would give another dungeon. */
export const DUNGEON_GENERATOR_VERSION = 1;

export interface CellPoint {
  x: number;
  y: number;
}

export interface CellDir {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

/** Normal rooms count towards size and get numbers; corridors are one cell wide; a junction is 1 × 1. */
export type RoomKind = 'room' | 'corridor' | 'junction';

/** Which part of the dungeon's plan a room belongs to. */
export type Wing = 'regular' | 'approach' | 'culmination' | 'secret';

export interface DungeonRoom {
  id: number;
  /** Floor rectangle, walls excluded, in cells. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: RoomKind;
  /** Drawn as a circle through the four cardinal door cells (radius √(w² + 1) / 2). */
  rotunda: boolean;
  /** The culmination room: farthest from the entrance, holds the boss. */
  ending: boolean;
  wing: Wing;
  /** Rooms of one mirror group share it; equal seeds grew identical subtrees. */
  group: number;
  /** Parent room id, or null for the first room. */
  parent: number | null;
  /** The axis the room grew along, from its parent into it. */
  axis: CellDir;
  /** Column rows along the long walls, or a ring in a rotunda. */
  colonnade: boolean;
}

/**
 * 0 open passage · 1 door · 2 doorway · 3 entrance stairs · 4 portcullis · 5 locked gate ·
 * 6 secret door · 7 barricade · 8 stairs down · 9 steps.
 */
export type DoorKind =
  | 'open'
  | 'door'
  | 'doorway'
  | 'entrance'
  | 'portcullis'
  | 'gate'
  | 'secret'
  | 'barricade'
  | 'stairs-down'
  | 'steps';

export interface DungeonDoor {
  /** The door cell in the shared wall. */
  x: number;
  y: number;
  /** From the parent room (or the outside) into the child room. */
  dir: CellDir;
  kind: DoorKind;
  /** Room on each side; null for the outside of an entrance or stairs down. */
  from: number | null;
  to: number | null;
}

export interface DungeonNote {
  /** The printed number, "1".."n", in order of path distance from the entrance. */
  ref: string;
  text: string;
  room: number;
  /** Where the GM dragged the note's box on the page, in cells; unset is placed automatically. */
  manual?: CellPoint;
}

export type PropKind =
  | 'barrel'
  | 'crate'
  | 'chest'
  | 'fountain'
  | 'well'
  | 'statue'
  | 'sarcophagus'
  | 'altar'
  | 'throne'
  | 'dais'
  | 'tapestry';

export interface DungeonProp {
  kind: PropKind;
  /** Centre, in cells. */
  x: number;
  y: number;
  /** Radians; 0 faces up (towards −y). */
  rotation: number;
  /** Scale, 1 = the prop's natural size. */
  scale: number;
  room: number;
}

export interface DungeonColumn {
  x: number;
  y: number;
  /** In cells. */
  radius: number;
  square: boolean;
  shattered: boolean;
}

/** A small stone: a smoothed quad around its centre. */
export interface DungeonRubble {
  points: CellPoint[];
}

/** A tapered zig-zag from a wall into a room; `width` at its start, in cells. */
export interface DungeonCrack {
  points: CellPoint[];
  width: number;
}

/** A closed pool outline (already smoothed), clipped to floors by the renderer. */
export interface DungeonWater {
  outline: CellPoint[];
}

export interface DungeonModel {
  version: number;
  seed: number;
  /** The tags the dungeon was built with: the GM's merged with those its name implies. */
  tags: string[];
  title: string;
  story: string;
  rooms: DungeonRoom[];
  doors: DungeonDoor[];
  notes: DungeonNote[];
  columns: DungeonColumn[];
  props: DungeonProp[];
  rubble: DungeonRubble[];
  cracks: DungeonCrack[];
  water: DungeonWater[];
  /** Floor cells under water, for exports. */
  waterCells: CellPoint[];
}

/** What a GM asks for: everything else follows from it. */
export interface DungeonRequest {
  seed: number;
  tags: string[];
  /** A name the GM typed; unset lets the generator name the dungeon. */
  name?: string;
  /** 0..1; unset follows the tags (dry 0, wet 0.3, flooded 0.6, else random). */
  waterLevel?: number;
}
