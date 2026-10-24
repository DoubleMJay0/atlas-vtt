/**
 * How well a room type fits a room, and the rules a type must never break there. Every step of
 * assignment (anchors, clusters, fills and swaps) compares rooms by `roomScore` and keeps to
 * `breaksHardRule`.
 */

import type { PlannedFloor } from '../../floors/planFloors';
import type { RoomTypeId } from '../roomTypes';
import type { ClimaxSpec, DepthBand, FloorRule, RoomProgramme, RoomTypeSpec, SizeClass, ThemeFacts } from '../themeTypes';
import { type RoomTraits, roomTraits } from './roomTraits';
import { type TypeGraph, typeGraph } from './typeGraph';

export interface Assignment {
  readonly traits: readonly RoomTraits[];
  readonly graph: TypeGraph;
  readonly programme: RoomProgramme;
  readonly facts: ThemeFacts;
  /** How many floors the dungeon has. */
  readonly floors: number;
  readonly ruined: boolean;
  /** Each normal room's type by its traits index; null while untyped. */
  types: (RoomTypeId | null)[];
  /** Rooms whose type the anchors set, which swaps leave alone. */
  fixed: boolean[];
  pivot: number | null;
  climax: ClimaxSpec | null;
}

/** An assignment of the floors' normal rooms with no room typed yet. */
export function newAssignment(floors: readonly PlannedFloor[], programme: RoomProgramme, facts: ThemeFacts, ruined: boolean): Assignment {
  const traits = roomTraits(floors);
  return {
    traits,
    graph: typeGraph(floors, traits),
    programme,
    facts,
    floors: floors.length,
    ruined,
    types: traits.map(() => null),
    fixed: traits.map(() => false),
    pivot: null,
    climax: null,
  };
}

const SIZES: readonly SizeClass[] = ['tiny', 'small', 'medium', 'large', 'largest'];
const BANDS: readonly DepthBand[] = ['front', 'middle', 'deep', 'deepest'];

const listOf = <T>(value: T | readonly T[] | undefined): readonly T[] => (value === undefined ? [] : Array.isArray(value) ? value : [value as T]);

/** A type's spec in a programme. */
export function specOf(programme: RoomProgramme, id: RoomTypeId): RoomTypeSpec | undefined {
  return programme.rooms.find((spec) => spec.id === id);
}

/** How many bands lie between a room's depth and the band a type wants; the deepest room lies in the deep band too. */
function bandDistance(wanted: DepthBand, band: DepthBand): number {
  if (wanted !== 'deepest' && band === 'deepest') return Math.abs(BANDS.indexOf(wanted) - BANDS.indexOf('deep'));
  return Math.abs(BANDS.indexOf(wanted) - BANDS.indexOf(band));
}

/** Whether a room keeps a type's floor rule; on one floor, beyond and last read as the deep third. */
function keepsFloor(rule: FloorRule, t: RoomTraits, floors: number): boolean {
  if (rule === 'entrance') return t.floor === 0;
  if (floors === 1) return t.band === 'deep' || t.band === 'deepest';
  return rule === 'beyond' ? t.floor > 0 : t.floor === floors - 1;
}

const plusOrMinus = (match: boolean, plus: number, minus: number): number => (match ? plus : -minus);

/** How well a room's own traits fit a type: depth, size, doors, floor, shape, outer wall and columns. */
export function fitScore(spec: RoomTypeSpec, t: RoomTraits, floors: number): number {
  let score = 0;
  const bands = listOf(spec.depth);
  if (bands.length) {
    const off = Math.min(...bands.map((band) => bandDistance(band, t.band)));
    score += off === 0 ? 2 : -3 * off;
  }
  const sizes = listOf(spec.size);
  if (sizes.length) {
    const off = Math.min(...sizes.map((size) => Math.abs(SIZES.indexOf(size) - SIZES.indexOf(t.size))));
    score += off === 0 ? 2 : -off;
  }
  const degrees = listOf(spec.degree);
  if (degrees.length) score += plusOrMinus(degrees.includes(t.degree), 1.5, 1.5);
  if (spec.floor) score += plusOrMinus(keepsFloor(spec.floor, t, floors), 3, 6);
  if (spec.shape) score += plusOrMinus(spec.shape === 'long' ? t.long : t.square, 1, 3);
  if (spec.outerWall) score += plusOrMinus(t.outerWall, 1, 3);
  if (t.colonnade) score += spec.terrain.columns ? 1 : -1;
  return score;
}

const typesAround = (a: Assignment, rooms: readonly number[]): Set<RoomTypeId> => new Set(rooms.flatMap((j) => (a.types[j] ? [a.types[j] as RoomTypeId] : [])));

/** How well a room's type sits among its neighbours' types: wanted ones next or near, never an `apart` one next. */
export function adjacencyScore(a: Assignment, i: number): number {
  const id = a.types[i];
  const spec = id ? specOf(a.programme, id) : undefined;
  if (!id || !spec) return 0;
  const next = typesAround(a, a.graph.next(i));
  let score = 0;
  if (spec.next?.length) score += spec.next.some((type) => next.has(type)) ? 2 : -2;
  if (spec.near?.length && spec.near.some((type) => typesAround(a, a.graph.near(i)).has(type))) score += 1;
  for (const type of next) if (apart(a.programme, id, type)) score -= 10;
  return score;
}

/** Whether two types must never stand next to each other (either names the other). */
function apart(programme: RoomProgramme, a: RoomTypeId, b: RoomTypeId): boolean {
  return Boolean(specOf(programme, a)?.apart?.includes(b) || specOf(programme, b)?.apart?.includes(a));
}

/** The one score fills and swaps compare: the room's fit, its neighbours and what the theme knows of it. */
export function roomScore(a: Assignment, i: number, id: RoomTypeId): number {
  const t = a.traits[i];
  const spec = specOf(a.programme, id);
  if (!t || !spec) return -Infinity;
  const held = a.types[i] ?? null;
  a.types[i] = id;
  const score = fitScore(spec, t, a.floors) + adjacencyScore(a, i) + a.facts.score(id, { floor: t.floor, room: t.room });
  a.types[i] = held;
  return score;
}

/** How many rooms other than `i` hold `id`, on `i`'s floor where the type counts per floor. */
export function heldCount(a: Assignment, id: RoomTypeId, i: number, perFloor = false): number {
  const floor = a.traits[i]?.floor;
  return a.types.filter((type, j) => j !== i && type === id && (!perFloor || a.traits[j]?.floor === floor)).length;
}

/** Whether a type of the theme's programme may not stand in room `i` at all. */
export function breaksHardRule(a: Assignment, i: number, id: RoomTypeId): boolean {
  const t = a.traits[i];
  const spec = specOf(a.programme, id);
  if (!t || !spec) return true;
  if (spec.floor === 'entrance' && t.floor !== 0) return true;
  if (spec.floor === 'beyond' && a.floors > 1 && t.floor === 0) return true;
  if (spec.floor === 'last' && a.floors > 1 && t.floor !== a.floors - 1) return true;
  if (spec.ruinedOnly && !a.ruined) return true;
  if (spec.climaxOnly && !t.boss) return true;
  if (spec.holdsStairs && !t.stairs) return true;
  if (heldCount(a, id, i, spec.perFloor) >= spec.count[1]) return true;
  if (a.graph.next(i).some((j) => a.types[j] && apart(a.programme, id, a.types[j] as RoomTypeId))) return true;
  return !a.facts.allows(id, { floor: t.floor, room: t.room });
}
