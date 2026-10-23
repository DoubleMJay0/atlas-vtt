/**
 * One floor's rooms and doors, the passes in the order each needs the ones before it. A floor that
 * misses a rule (too few rooms, no loop on its main way, no room for a second entrance or the
 * stairwells it needs) is grown anew from another start; the attempts are seeded, so a seed always gives the same floor.
 */

import type { CellRect } from '../geometry';
import type { DungeonParams } from '../params';
import { type KeyedRng, type Rng, floorStream } from '../rng';
import { addBossDoor, placeBossRoom } from './boss';
import { cleanUp } from './cleanup';
import { type CompactLayout, compactLayout } from './compact';
import { placeEntrances } from './entrances';
import { addRewardRoom, withStages } from './fiveRoom';
import { floorRulesHold } from './floorRules';
import { type FloorRoot, growTree, normalCount } from './grow';
import { growPass } from './growPass';
import { addLoops, addSecretLoops } from './loops';
import { shapeRooms } from './roomShapes';
import { placeSecretWings } from './secrets';
import { addSteps } from './steps';

const MAX_ATTEMPTS = 120;

export interface FloorRequest {
  /** 0 is the entry floor. */
  floor: number;
  params: DungeonParams;
  /** Where an attempt's first room stands; null when this attempt finds no place for it. */
  rootOf: (rng: Rng) => FloorRoot | null;
  /** The ground before the entrance, on the entry floor. */
  reserved: CellRect | null;
  /** Where every room must lie, or null for anywhere. */
  within: CellRect | null;
  /** Cells no door may open onto: the landing of the stairs from above. */
  blocked: ReadonlySet<string>;
  /** Whether the floor has the boss room. */
  boss: boolean;
  /**
   * Where a gallery could look down into the boss room: the floors of the rooms above, less
   * their walls' ring. A boss room under one of them is preferred, so it can be two floors high.
   */
  galleries?: readonly CellRect[];
  /** A five-room dungeon: no loops or secret wings, a reward room beyond the boss room, stages named. */
  fiveRoom?: boolean;
  /** What else the finished floor must allow: the stairwells it needs to and from the floors beside it. */
  accept: (layout: CompactLayout) => boolean;
}

interface Built {
  layout: CompactLayout;
  normals: number;
  /** Keeps the rules between floors, which no fallback may break. */
  linked: boolean;
  /** How many of the floor's own rules it keeps: its fewest rooms, its entrances, its boss room, its loop. */
  kept: number;
}

const FLOOR_RULES = 4;

function sound(built: Built): boolean {
  return built.linked && built.kept === FLOOR_RULES;
}

/** Whether `a` is the better fallback: linked first, then the more rules kept, then the more rooms. */
function better(a: Built, b: Built): boolean {
  if (a.linked !== b.linked) return a.linked;
  return a.kept !== b.kept ? a.kept > b.kept : a.normals > b.normals;
}

function attempt(seed: number, request: FloorRequest, index: number): Built | null {
  const { floor, params } = request;
  const rngOf: KeyedRng = (key) => floorStream(seed, 'layout', floor, `${index}:${key}`);
  const root = request.rootOf(rngOf('root'));
  if (!root) return null;
  const work = growTree(rngOf, params, root, { reserved: request.reserved, within: request.within, blocked: request.blocked });
  const normals = normalCount(work);
  growPass(rngOf, work);
  const placed = !request.boss || placeBossRoom(work, request.galleries ?? []);
  if (!request.fiveRoom) addLoops(rngOf, work, params);
  addBossDoor(rngOf, work);
  const boss = placed && (!request.fiveRoom || addRewardRoom(rngOf, work));
  if (!request.fiveRoom) {
    placeSecretWings(rngOf, work, params);
    addSecretLoops(rngOf, work, params);
  }
  cleanUp(work);
  const entrances = floor > 0 || placeEntrances(rngOf, work, params);
  addSteps(rngOf, work, params);
  shapeRooms(rngOf, work, params);
  const layout = request.fiveRoom ? withStages(compactLayout(work)) : compactLayout(work);
  const kept = [normals >= params.minRooms, entrances, boss, floorRulesHold(layout)].filter(Boolean).length;
  return { layout, normals, linked: request.accept(layout), kept };
}

export interface BuiltFloor {
  layout: CompactLayout;
  /** Keeps every rule; a floor that does not is the best attempt there was. */
  sound: boolean;
}

/** The first attempt that keeps every rule, else the best of them (`better`); null where no attempt found a place for its first room. */
export function buildFloorLayout(seed: number, request: FloorRequest): BuiltFloor | null {
  let best: Built | null = null;
  for (let index = 0; index < MAX_ATTEMPTS; index++) {
    const built = attempt(seed, request, index);
    if (!built) continue;
    if (sound(built)) return { layout: built.layout, sound: true };
    if (!best || better(built, best)) best = built;
  }
  return best ? { layout: best.layout, sound: false } : null;
}
