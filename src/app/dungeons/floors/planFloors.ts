/**
 * Every floor's rooms, doors and stairwells, planned together in one cell grid. The entry floor
 * grows from its entrance at (0, 0); each next floor (below it in a Cavern, above it in a building:
 * the stack) grows from the end of the stairs that lead to it, and is grown anew until the stairs
 * between it and the floor before can stand (two where both have six rooms or more) and, unless it
 * is the last, a stairwell can lead on.
 */

import type { CellRect } from '../geometry';
import type { CellDir, DungeonDoor, DungeonRoom, DungeonStair } from '../model';
import { type DungeonParams, floorParams } from '../params';
import { MAX_SEED, floorStream, int, pick } from '../rng';
import { type FloorRequest, buildFloorLayout } from '../layout/assemble';
import type { CompactLayout } from '../layout/compact';
import { dir, floorRect, inRect, wallRect } from '../geometry';
import { TWO_CONNECTIONS_FROM, type FloorShape, chooseOnward, extraConnection, normalRooms } from './connections';
import { type FloorStack, floorStack, isAbove, stairEnd } from './floorStack';
import type { ThemeDefinition } from '../themes/themeTypes';
import { landingCells, landingRoot } from './landing';
import { type StairSpot, spotRect } from './stairSpots';

/** Nothing but the first room may cover the ground before the entrance. */
const ENTRANCE_BLOCK: CellRect = { x0: -1, y0: -1, x1: 1, y1: 1 };
const AXES: readonly CellDir[] = [dir(0, 1), dir(1, 0), dir(0, -1), dir(-1, 0)];

export interface PlannedFloor {
  rooms: DungeonRoom[];
  doors: DungeonDoor[];
  stairs: DungeonStair[];
}

interface Link {
  /** Stairwells between the floor before and this one beyond the first. */
  extra: StairSpot[];
}

/** How far a floor may reach past the one before it, in cells: digging follows what was dug, a storey what it stands on. */
const REACH_PAST_EARLIER = 2;

/** The ground a later floor may take: over or under the floor before, a little past it. */
function footprintOf(earlier: Pick<FloorShape, 'rooms'>): CellRect {
  const walls = earlier.rooms.map(wallRect);
  return {
    x0: Math.min(...walls.map((r) => r.x0)) - REACH_PAST_EARLIER,
    y0: Math.min(...walls.map((r) => r.y0)) - REACH_PAST_EARLIER,
    x1: Math.max(...walls.map((r) => r.x1)) + REACH_PAST_EARLIER,
    y1: Math.max(...walls.map((r) => r.y1)) + REACH_PAST_EARLIER,
  };
}

/** The floor of the room on `floor` that holds the stairwell `spot`, if one does. */
function stairRoomFloor(floor: Pick<FloorShape, 'rooms'>, spot: StairSpot): CellRect | null {
  const r = spotRect(spot);
  const room = floor.rooms.find((candidate) => candidate.kind === 'room' && inRect(floorRect(candidate), r.x0, r.y0) && inRect(floorRect(candidate), r.x1, r.y1));
  return room ? floorRect(room) : null;
}

function stairsRng(seed: number, floor: number, key: string): () => number {
  return floorStream(seed, 'stairs', floor, key);
}

function withStairs(floor: { rooms: DungeonRoom[]; doors: DungeonDoor[] }, stairs: DungeonStair[]): PlannedFloor {
  return { rooms: floor.rooms, doors: floor.doors, stairs };
}

/** The two ends of a stairwell from floor `earlier` to the next: the earlier floor's, then the next floor's. */
function stairPair(spot: StairSpot, earlier: number, link: number): [DungeonStair, DungeonStair] {
  const rect = { x: spot.x, y: spot.y, w: spot.w, h: spot.h, down: spot.down };
  return [
    { ...rect, to: earlier + 1, link },
    { ...rect, to: earlier, link },
  ];
}

/**
 * The stairs a new floor `index` needs beyond the landing, given the floor before as planned so far:
 * a second stairwell where both are large enough, then whether a way leads on. Null where what is
 * needed cannot stand.
 */
function linkFloor(seed: number, earlier: FloorShape, later: FloorShape, index: number, last: boolean, stack: FloorStack): Link | null {
  const extra: StairSpot[] = [];
  let before = earlier;
  let after = later;
  if (normalRooms(earlier) >= TWO_CONNECTIONS_FROM && normalRooms(later) >= TWO_CONNECTIONS_FROM) {
    const spot = extraConnection(stairsRng(seed, index, 'extra'), before, after, index - 1, stack);
    if (!spot) return null;
    extra.push(spot);
    before = { ...before, stairs: [...before.stairs, { ...spot, to: index }] };
    after = { ...after, stairs: [...after.stairs, { ...spot, to: index - 1 }] };
  }
  if (!last && !chooseOnward(stairsRng(seed, index, 'descent'), after, index, stack)) return null;
  return { extra };
}

/**
 * Floor `index`, grown from the `landing` end of the stairs from the floor before: within that
 * floor's footprint where it can keep every rule there, else wherever it can.
 */
function nextFloor(seed: number, params: DungeonParams, earlier: FloorShape, index: number, last: boolean, landing: DungeonStair, boss: boolean, stack: FloorStack): CompactLayout | null {
  const end = stairEnd(stack, index, index - 1);
  const request: FloorRequest = {
    floor: index,
    params: floorParams(params, index, stack.rise),
    rootOf: (rng) => landingRoot(rng, landing, end, isAbove(stack, index, index - 1) ? stairRoomFloor(earlier, landing) : null),
    reserved: null,
    within: footprintOf(earlier),
    boss: boss && last,
    // A boss room that lies under a room of the floor above counts larger, so a gallery can look into it.
    galleries: isAbove(stack, index - 1, index) ? earlier.rooms.filter((room) => room.kind === 'room' && room.wing === 'regular' && !room.rotunda).map(floorRect) : [],
    blocked: landingCells(landing, end),
    accept: (built) => linkFloor(seed, earlier, { ...built, stairs: [landing] }, index, last, stack) !== null,
  };
  const within = buildFloorLayout(seed, request);
  if (within?.sound) return within.layout;
  return (buildFloorLayout(seed, { ...request, within: null }) ?? within)?.layout ?? null;
}

/** What a theme says of how its floors are planned: which way they stack, whether the stairs up rise from the entrance room, and how deep that room is at least. */
export type FloorPlanning = Pick<ThemeDefinition, 'rise' | 'stairsFromEntrance' | 'entranceDepth'>;

/**
 * Every floor, in order from the entrance floor, each next one lying the way `planning.rise` says;
 * a five-room dungeon (`fiveRoom`) is one floor of five main rooms.
 */
export function planFloors(seed: number, params: DungeonParams, count: number, boss: boolean, fiveRoom = false, planning: FloorPlanning = { rise: 'down' }): PlannedFloor[] {
  const { rise } = planning;
  const stack = floorStack(rise, count);
  const fromEntrance = planning.stairsFromEntrance === true;
  const entry = buildFloorLayout(seed, {
    floor: 0,
    params: floorParams(params, 0, rise),
    rootOf: (rng) => ({ origin: { x: 0, y: 0 }, axis: pick(rng, AXES), seed: int(rng, 1, MAX_SEED), ...(planning.entranceDepth !== undefined && { minDepth: planning.entranceDepth }) }),
    reserved: ENTRANCE_BLOCK,
    within: null,
    boss: boss && count === 1,
    fiveRoom: fiveRoom && count === 1,
    blocked: new Set(),
    accept: (layout) => count === 1 || chooseOnward(stairsRng(seed, 0, 'descent'), { ...layout, stairs: [] }, 0, stack, fromEntrance) !== null,
  });
  if (!entry) throw new Error('no dungeon layout');
  const floors: PlannedFloor[] = [withStairs(entry.layout, [])];
  let link = 0;
  for (let index = 1; index < count; index++) {
    const earlier = floors[index - 1] as PlannedFloor;
    const onward = chooseOnward(stairsRng(seed, index - 1, 'descent'), earlier, index - 1, stack, index === 1 && fromEntrance);
    if (!onward) break;
    const [from, landing] = stairPair(onward.spot, index - 1, link++);
    const earlierWithStairs = { ...earlier, stairs: [...earlier.stairs, from] };
    const last = index === count - 1;
    const layout = nextFloor(seed, params, earlierWithStairs, index, last, landing, boss, stack);
    if (!layout) break;
    const extra = linkFloor(seed, earlierWithStairs, { ...layout, stairs: [landing] }, index, last, stack)?.extra ?? [];
    const pairs = extra.map((spot) => stairPair(spot, index - 1, link++));
    floors[index - 1] = { ...earlier, stairs: [...earlierWithStairs.stairs, ...pairs.map(([e]) => e)] };
    floors.push(withStairs(layout, [landing, ...pairs.map(([, l]) => l)]));
  }
  return floors;
}
