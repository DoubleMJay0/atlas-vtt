/**
 * Every floor's rooms, doors and stairwells, planned together in one cell grid. The entry floor
 * grows from its entrance at (0, 0); each floor below grows from the landing of the stairs that
 * lead down to it, and is grown anew until the stairs between it and the floor above can stand
 * (two where both have six rooms or more) and, unless it is the last, a stairwell can lead on down.
 */

import type { CellRect } from '../geometry';
import type { CaveFloor, CellDir, DungeonDoor, DungeonRoom, DungeonStair } from '../model';
import { type DungeonParams, floorParams } from '../params';
import { MAX_SEED, floorStream, int, pick } from '../rng';
import { type FloorRequest, buildFloorLayout } from '../layout/assemble';
import type { CompactLayout } from '../layout/compact';
import { dir, floorRect, wallRect } from '../geometry';
import type { CaveFloorPlan } from '../layout/cavern/caveGrid';
import { type LaneEnd, clearOfLane, finalEnd, laneFits } from '../layout/cavern/mainPath';
import { TWO_CONNECTIONS_FROM, type FloorShape, type PlacedStair, chooseDescent, extraConnection, normalRooms } from './connections';
import { landingCells, landingRoot } from './landing';
import type { StairSpot } from './stairSpots';

/** Nothing but the first room may cover the ground before the entrance. */
const ENTRANCE_BLOCK: CellRect = { x0: -1, y0: -1, x1: 1, y1: 1 };
const AXES: readonly CellDir[] = [dir(0, 1), dir(1, 0), dir(0, -1), dir(-1, 0)];

export interface PlannedFloor {
  rooms: DungeonRoom[];
  doors: DungeonDoor[];
  stairs: DungeonStair[];
  /** A Cavern floor's geology, written by `shapeCaves`, so the Cavern's facts read it from the floors assignment receives. */
  cave?: CaveFloor;
}

interface Link {
  /** Stairwells between the floor above and this one beyond the first. */
  extra: StairSpot[];
  /** Where the way on down stands; none on the last floor. */
  descent: PlacedStair | null;
}

/** How far a floor may reach past the one above it, in cells: digging follows what was dug. */
const REACH_PAST_ABOVE = 2;

/** The ground a floor further down may take: under the floor above, a little past it. */
function underneath(above: Pick<FloorShape, 'rooms'>): CellRect {
  const walls = above.rooms.map(wallRect);
  return {
    x0: Math.min(...walls.map((r) => r.x0)) - REACH_PAST_ABOVE,
    y0: Math.min(...walls.map((r) => r.y0)) - REACH_PAST_ABOVE,
    x1: Math.max(...walls.map((r) => r.x1)) + REACH_PAST_ABOVE,
    y1: Math.max(...walls.map((r) => r.y1)) + REACH_PAST_ABOVE,
  };
}

function stairsRng(seed: number, floor: number, key: string): () => number {
  return floorStream(seed, 'stairs', floor, key);
}

function withStairs(floor: { rooms: DungeonRoom[]; doors: DungeonDoor[] }, stairs: DungeonStair[]): PlannedFloor {
  return { rooms: floor.rooms, doors: floor.doors, stairs };
}

function stairPair(spot: StairSpot, upper: number, link: number): [DungeonStair, DungeonStair] {
  const rect = { x: spot.x, y: spot.y, w: spot.w, h: spot.h, down: spot.down };
  return [
    { ...rect, to: upper + 1, link },
    { ...rect, to: upper, link },
  ];
}

/**
 * The stairs a new floor `index` needs beyond the landing, given the floor above as planned so far:
 * a second stairwell where both are large enough, then whether a way leads on down. Null where
 * what is needed cannot stand.
 */
function linkFloor(seed: number, above: FloorShape, below: FloorShape, index: number, last: boolean, across: number, keepsLane: (spot: StairSpot) => boolean): Link | null {
  const extra: StairSpot[] = [];
  let upper = above;
  let lower = below;
  if (normalRooms(above) >= TWO_CONNECTIONS_FROM && normalRooms(below) >= TWO_CONNECTIONS_FROM) {
    const spot = extraConnection(stairsRng(seed, index, 'extra'), upper, lower, index - 1, keepsLane);
    if (!spot) return null;
    extra.push(spot);
    upper = { ...upper, stairs: [...upper.stairs, { ...spot, to: index }] };
    lower = { ...lower, stairs: [...lower.stairs, { ...spot, to: index - 1 }] };
  }
  const descent = last ? null : chooseDescent(stairsRng(seed, index, 'descent'), lower, index, across);
  if (!last && !descent) return null;
  return { extra, descent };
}

/**
 * Whether a cave floor's main path fits two cells wide from where it is entered to its way down
 * (`descent`), or on the last floor to its boss room or farthest room. Always, for any other theme.
 */
function laneHolds(params: DungeonParams, floor: CaveFloorPlan, index: number, from: LaneEnd, descent: PlacedStair | null, boss: boolean): boolean {
  if (!params.cave) return true;
  if (!descent) return laneFits(floor, from, finalEnd(floor, from, boss), index);
  return laneFits({ ...floor, stairs: [...floor.stairs, { ...descent.spot, to: index + 1 }] }, from, { kind: 'stair', spot: descent.spot }, index);
}

/**
 * Floor `index`, grown from the landing of `descent`: under the floor above where it can keep every
 * rule there, else wherever it can.
 */
function floorBelow(seed: number, params: DungeonParams, above: FloorShape, index: number, last: boolean, landing: DungeonStair, boss: boolean): CompactLayout | null {
  const keepsLane = params.cave ? clearOfLane(above, index - 1) : (): boolean => true;
  const request: FloorRequest = {
    floor: index,
    params: floorParams(params, index),
    rootOf: (rng) => landingRoot(rng, landing, params.minRoomFloor),
    reserved: null,
    within: underneath(above),
    boss: boss && last,
    galleries: above.rooms.filter((room) => room.kind === 'room' && room.wing === 'regular' && !room.rotunda).map(floorRect),
    blocked: landingCells(landing),
    accept: (built) => {
      const link = linkFloor(seed, above, { ...built, stairs: [landing] }, index, last, params.stairAcross ?? 1, keepsLane);
      const stairs = [landing, ...(link?.extra ?? []).map((spot) => ({ ...spot, to: index - 1 }))];
      return link !== null && laneHolds(params, { ...built, stairs }, index, { kind: 'stair', spot: landing }, link.descent, boss && last);
    },
  };
  const under = buildFloorLayout(seed, request);
  if (under?.sound) return under.layout;
  return (buildFloorLayout(seed, { ...request, within: null }) ?? under)?.layout ?? null;
}

/** Every floor; a five-room dungeon (`fiveRoom`) is one floor of five main rooms. */
export function planFloors(seed: number, params: DungeonParams, count: number, boss: boolean, fiveRoom = false): PlannedFloor[] {
  const entry = buildFloorLayout(seed, {
    floor: 0,
    params: floorParams(params, 0),
    rootOf: (rng) => ({ origin: { x: 0, y: 0 }, axis: pick(rng, AXES), seed: int(rng, 1, MAX_SEED) }),
    reserved: ENTRANCE_BLOCK,
    within: null,
    boss: boss && count === 1,
    fiveRoom: fiveRoom && count === 1,
    blocked: new Set(),
    accept: (layout) => {
      const descent = count === 1 ? null : chooseDescent(stairsRng(seed, 0, 'descent'), { ...layout, stairs: [] }, 0, params.stairAcross);
      return (count === 1 || descent !== null) && laneHolds(params, { ...layout, stairs: [] }, 0, { kind: 'entrance' }, descent, boss && count === 1);
    },
  });
  if (!entry) throw new Error('no dungeon layout');
  const floors: PlannedFloor[] = [withStairs(entry.layout, [])];
  let link = 0;
  for (let index = 1; index < count; index++) {
    const above = floors[index - 1] as PlannedFloor;
    const descent = chooseDescent(stairsRng(seed, index - 1, 'descent'), above, index - 1, params.stairAcross);
    if (!descent) break;
    const [down, up] = stairPair(descent.spot, index - 1, link++);
    const aboveWithStairs = { ...above, stairs: [...above.stairs, down] };
    const last = index === count - 1;
    const layout = floorBelow(seed, params, aboveWithStairs, index, last, up, boss);
    if (!layout) break;
    const keepsLane = params.cave ? clearOfLane(aboveWithStairs, index - 1) : () => true;
    const extra = linkFloor(seed, aboveWithStairs, { ...layout, stairs: [up] }, index, last, params.stairAcross ?? 1, keepsLane)?.extra ?? [];
    const pairs = extra.map((spot) => stairPair(spot, index - 1, link++));
    floors[index - 1] = { ...above, stairs: [...aboveWithStairs.stairs, ...pairs.map(([u]) => u)] };
    floors.push(withStairs(layout, [up, ...pairs.map(([, l]) => l)]));
  }
  return floors;
}
