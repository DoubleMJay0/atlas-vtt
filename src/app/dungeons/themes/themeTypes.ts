/**
 * What a theme is, as plain data: a room programme of room types, each with how many a dungeon
 * holds, where in it they stand, which neighbours they need or must never have, the terrain they
 * allow and a furnishing recipe. Assignment (`assign/`) types the rooms of a generated layout by
 * it; terrain and furniture then read each room's type.
 */

import type { PlannedFloor } from '../floors/planFloors';
import type { CellPoint, FiveRoomStage, TerrainKind } from '../model';
import type { PropKind } from '../props/propKinds';
import type { DungeonTag } from '../tags';
import type { HazardChoice } from '../terrain/hazards';
import type { MessageKey } from '../../i18n';
import type { FeatureReason } from './features';
import type { RoomTypeId } from './roomTypes';

export type ThemeId = 'fortress' | 'mansion' | 'cavern';
/** What a GM picks: a theme, or Any, which the seed decides. */
export type ThemeChoice = ThemeId | 'any';
export const THEME_IDS: readonly ThemeId[] = ['fortress', 'mansion', 'cavern'];

/**
 * How a piece finds its place: before the back wall, against a wall, in rows, in the middle, as a
 * mirrored pair, in a corner, around its parent, on a grid, or beside the room's liquid.
 */
export type Verb = 'backWall' | 'wall' | 'rows' | 'centre' | 'flank' | 'corner' | 'withParent' | 'grid' | 'shore';

export interface Piece {
  kind: PropKind;
  verb: Verb;
  /** For `withParent`: the kind it is placed around (the last such piece placed). */
  parent?: PropKind;
  /** For `flank`: a pair either side of the room's inner door; unset, either side of the defining piece. */
  of?: 'door';
  /** How many, drawn from the range; unset, one. */
  count?: readonly [number, number];
  /** The chance it is there at all; unset, 1. */
  chance?: number;
}

export interface FurnishRecipe {
  /** The piece that tells what the room is for, placed first. */
  defining?: Piece;
  /** A piece that belongs to the defining one (the dais's high table or throne). */
  with?: Piece;
  pieces: readonly Piece[];
}

export interface RoomTerrain {
  /** Why the type has its holes, hazards and standing water: each of those is placed only for one of these (`features.ts`). */
  features?: readonly FeatureReason[];
  /** The hazards the type may take; a type without any takes none. */
  hazards?: readonly HazardChoice[];
  /** Terrain kinds the type allows beyond its furniture. */
  allows?: readonly TerrainKind[];
  /** Keeps a colonnade where the layout gives one. */
  columns?: true;
  /** Standing water it may hold: a pool or shallow water. */
  water?: 'pool' | 'shallow';
  /** Holes it may have cut through its floor. */
  holes?: readonly ('gallery' | 'chasm' | 'shaft')[];
}

export type SizeClass = 'tiny' | 'small' | 'medium' | 'large' | 'largest';
/** Thirds of the hop depth from the entrance; `deepest` is the deepest room of the last floor. */
export type DepthBand = 'front' | 'middle' | 'deep' | 'deepest';
export type Degree = 'dead-end' | 'through' | 'hub';
/** The entrance floor, any floor beyond it, or the floor furthest from it. */
export type FloorRule = 'entrance' | 'beyond' | 'last';

export interface RoomTypeSpec {
  id: RoomTypeId;
  /** How many a dungeon holds (per floor for `perFloor` types). */
  count: readonly [number, number];
  required?: true;
  /** Weight of an optional type's draw; unset, 1. */
  weight?: number;
  size?: SizeClass | readonly SizeClass[];
  depth?: DepthBand | readonly DepthBand[];
  degree?: Degree | readonly Degree[];
  floor?: FloorRule;
  shape?: 'long' | 'square';
  /** Only on a room with an outer wall. */
  outerWall?: true;
  /** Types it should share a door with (or only corridors and junctions between). */
  next?: readonly RoomTypeId[];
  /** Makes `next` a rule, not a wish: one of the types next to it (`any`) or every one (`all`, a servery between kitchen and dining room). */
  nextRule?: 'any' | 'all';
  /** Only the smallest room of its floor (a bathroom). */
  smallest?: true;
  /** Types it should lie within two normal rooms of. */
  near?: readonly RoomTypeId[];
  /** Types it must never stand next to. */
  apart?: readonly RoomTypeId[];
  terrain: RoomTerrain;
  furnish: FurnishRecipe;
  mayStandEmpty?: true;
  ruinedOnly?: true;
  /** Only ever the boss room's type (a throne room, a ritual room). */
  climaxOnly?: true;
  /** Taken by rooms holding a stairwell that no other anchor took. */
  holdsStairs?: true;
  /** `count` holds per floor, not per dungeon. */
  perFloor?: true;
}

export type ArenaSetPiece = 'statues' | 'altar' | 'ring' | 'pillars' | 'mosaic';

/** How the boss room of a climax type is furnished as an arena. */
export interface ArenaSpec {
  /** What stands on the platform; none for a climax without a seat. */
  seat: PropKind | null;
  /** Set pieces by weight. */
  setPieces: readonly (readonly [ArenaSetPiece, number])[];
  /** The kinds of mirrored cover it may take. */
  mirrored: readonly ('pillar' | 'statue' | 'wall-fragment' | 'rubble-heap')[];
  hazards: readonly HazardChoice[];
}

export interface ClimaxSpec {
  type: RoomTypeId;
  /** Relative: a draw renormalises over the climax types the room may take. */
  weight: number;
  arena: ArenaSpec;
  onlyOnEntranceFloor?: true;
  /** Drawn only where the boss room is the largest room of its floor (a ballroom). */
  onlyInLargest?: true;
}

export type ClusterId = 'service' | 'private' | 'reception' | 'guard';

/** Rooms that belong together: a core and the members placed next to or near it. */
export interface ClusterSpec {
  id: ClusterId;
  core: RoomTypeId;
  members: readonly RoomTypeId[];
  /** The room the core lies next to or near; none, the core goes by score. */
  anchor?: 'pivot' | 'entrance';
  link?: 'next' | 'near';
  /** A cluster whose branch this one keeps off. */
  apartFrom?: ClusterId;
  floor?: FloorRule;
}

export interface RoomProgramme {
  entrance: readonly (readonly [RoomTypeId, number])[];
  /** The hall the plan hangs on, in order of preference. */
  pivot: readonly RoomTypeId[];
  /** The type of a stairwell room no other anchor took. */
  stairs: RoomTypeId;
  climax: readonly ClimaxSpec[];
  clusters: readonly ClusterSpec[];
  stages: Readonly<Record<FiveRoomStage, readonly RoomTypeId[]>>;
  /** What rooms left over take, by weight. */
  filler: readonly (readonly [RoomTypeId, number])[];
  rooms: readonly RoomTypeSpec[];
  /** The share of a furnished room's optional pieces under dust sheets past the front third (the Mansion's haunting). */
  sheeted?: number;
}

export interface RoomRef {
  floor: number;
  room: number;
}

/**
 * What a theme knows of its own rooms beyond the layout's traits (a Cavern's basins, streams,
 * faults and its distance from the mouth): `allows` is a hard rule beside `breaksHardRule`'s,
 * `score` is added to `fitScore`, `placeAllowed` vetoes a piece's place, and `richness` (0..1)
 * scales a room's optional pieces after the depth ladder.
 */
export interface ThemeFacts {
  allows(type: RoomTypeId, room: RoomRef): boolean;
  score(type: RoomTypeId, room: RoomRef): number;
  placeAllowed(kind: PropKind, at: CellPoint, room: RoomRef): boolean;
  richness(room: RoomRef): number;
}

/** The floors as assignment receives them, after any theme's own shaping. */
export interface ThemeFactsInput {
  seed: number;
  tags: ReadonlySet<DungeonTag>;
  floors: readonly PlannedFloor[];
}

/**
 * `programme: null` furnishes by the rooms' architectural roles, as before themes (Cavern until
 * its programme lands). `programmeFor` gives a variant of the programme by the tags (Cavern's lava
 * tube and Underdark); without it, `programme`. `facts` is built once per dungeon, after the
 * layout; without it, nothing beyond the traits counts.
 */
export interface ThemeDefinition {
  id: ThemeId;
  /** Built by hands (a Fortress, a Mansion) rather than by nature. */
  built: boolean;
  /** Tags the theme cannot take, each with the reason the panel shows. */
  refuses: readonly { tag: DungeonTag; reason: MessageKey }[];
  programme: RoomProgramme | null;
  programmeFor?: (tags: ReadonlySet<DungeonTag>) => RoomProgramme;
  facts?: (input: ThemeFactsInput) => ThemeFacts;
}
