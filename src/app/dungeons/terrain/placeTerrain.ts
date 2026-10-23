/**
 * Every floor's terrain, placed together so holes line up between floors. First the gallery over
 * the boss arena (it opens the floor above it), then each floor from the top down: the arena and
 * the five-room stages, a shaft now and then, hazards (about one per six rooms, counting holes from
 * above), then each room by its size (Terrain principle 1): open rooms take height and strong
 * features, cramped rooms low clutter, every fight-sized room some cover, the quieter ones a point
 * of interest. The empty third stays empty but for what passes through it (a hole, the floor under one).
 */

import type { CellPoint, DungeonRoom, DungeonTerrain } from '../model';
import { cellKey } from '../geometry';
import type { RoomRole } from '../props/roles';
import { type Rng, chance, weighted } from '../rng';
import type { DungeonTag } from '../tags';
import { furnishArena } from './arena';
import { draft } from './catalog';
import { CRAMPED_AREA, crampedCover, ensureCover, openRoomCover } from './cover';
import { difficultGround } from './difficult';
import { ledgeAlongWall, platformAtFarWall } from './elevation';
import { type FloorPlan, FloorTerrain } from './floorTerrain';
import { hazardWeights, placeHazard } from './hazards';
import { anyInterest } from './interest';
import { furnishStage } from './stages';
import { galleryOverArena, shaftDown } from './vertical';
import { type TerrainWork, terrainWork } from './work';

/** Rooms of at least this much floor can hold a fight and get cover unless they are left empty. */
export const FIGHT_AREA = 12;
/** One hazard per this many normal rooms. */
const ROOMS_PER_HAZARD = 6;
/** How likely a quiet room of each role holds a point of interest. */
const INTEREST_CHANCE: Readonly<Record<RoomRole, number>> = { boss: 0, hall: 0.3, deepest: 0.6, stairs: 0.15, hub: 0.25, 'dead-end': 0.45, plain: 0.2 };

export interface TerrainFloorInput extends FloorPlan {
  roles: ReadonlyMap<number, RoomRole>;
  /** Normal rooms left without furniture. */
  empty: ReadonlySet<number>;
}

function hazardCount(floor: FloorTerrain): number {
  return floor.pieces.filter((p) => p.traits.hazard !== undefined).length;
}

/** Hazards up to about one per six rooms, in the larger regular rooms that hold nothing else yet. */
function hazards(work: TerrainWork, k: number, rooms: readonly DungeonRoom[], rng: Rng): void {
  const floor = work.floors[k];
  if (!floor) return;
  const target = rooms.length / ROOMS_PER_HAZARD;
  const wanted = Math.floor(target) + (chance(rng, target % 1) ? 1 : 0) - hazardCount(floor);
  let pool = rooms.filter((room) => room.wing === 'regular' && !room.boss && room.stage === undefined && (floor.room(room.id)?.floorCount ?? 0) >= 9 && floor.inRoom(room.id).length === 0);
  const weights = hazardWeights(work.tags).filter(([, w]) => w > 0);
  for (let placed = 0; placed < wanted && pool.length > 0; ) {
    const room = weighted(rng, pool.map((r) => [r, r.w * r.h] as const));
    pool = pool.filter((r) => r !== room);
    const rc = floor.room(room.id);
    if (rc && placeHazard(work, k, rc, rng, weighted(rng, weights))) placed++;
  }
}

/** Height, cover, difficult ground and a point of interest for an ordinary room. */
function furnishRoom(work: TerrainWork, k: number, room: DungeonRoom, role: RoomRole): void {
  const floor = work.floors[k];
  const rc = floor?.room(room.id);
  if (!floor || !rc) return;
  const rng = work.rng(k, `room:${room.id}`);
  const area = rc.floorCount;
  if (area > CRAMPED_AREA) {
    if (chance(rng, 0.35)) {
      if (chance(rng, 0.5) && rc.depth >= 6) platformAtFarWall(floor, rc, 1, rc.width - 2, 1);
      else ledgeAlongWall(floor, rc, rng);
    }
    openRoomCover(floor, rc, rng, work.tags);
  } else if (area >= FIGHT_AREA) crampedCover(floor, rc, rng, work.tags);
  difficultGround(floor, rc, rng, work.tags, role === 'hall');
  if (chance(rng, INTEREST_CHANCE[role])) anyInterest(floor, rc, rng, work.tags);
  if (area >= FIGHT_AREA) ensureCover(floor, rc, work.tags);
}

function furnishFloor(work: TerrainWork, k: number, input: TerrainFloorInput): void {
  const rooms = input.rooms.filter((room) => room.kind === 'room');
  for (const room of rooms) {
    const rc = work.floors[k]?.room(room.id);
    const rng = work.rng(k, `main:${room.id}`);
    if (!rc) continue;
    if (room.stage) furnishStage(work, k, rc, rng, room.stage, work.tags);
    else if (room.boss) furnishArena(work, k, rc, rng, work.tags);
  }
  shaftDown(work, k, work.rng(k, 'shaft'));
  hazards(work, k, rooms, work.rng(k, 'hazards'));
  for (const room of rooms) {
    if (room.boss || room.stage || input.empty.has(room.id)) continue;
    furnishRoom(work, k, room, input.roles.get(room.id) ?? 'plain');
  }
}

/** The terrain of every floor, as builders that still take the shallow water once it is known (`addShallowWater`). */
export function planTerrain(seed: number, floors: readonly TerrainFloorInput[], tags: ReadonlySet<DungeonTag>): FloorTerrain[] {
  const builders = floors.map((floor, index) => new FloorTerrain(index, floor));
  const work = terrainWork(seed, builders, tags);
  galleryOverArena(work, work.rng(builders.length - 1, 'gallery'));
  floors.forEach((floor, k) => furnishFloor(work, k, floor));
  return builders;
}

/** Shallow water as difficult ground: the water's cells in each room that no piece fills and nothing keeps clear. */
export function addShallowWater(floor: FloorTerrain, waterCells: readonly CellPoint[]): DungeonTerrain[] {
  const wet = new Set(waterCells.map((c) => cellKey(c.x, c.y)));
  for (const room of floor.plan.rooms) {
    const rc = floor.room(room.id);
    if (!rc) continue;
    const cells: CellPoint[] = [];
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (wet.has(cellKey(x, y)) && rc.isFree({ x, y })) cells.push({ x, y });
    if (cells.length > 0) floor.place(draft('shallow-water', room.id, cells));
  }
  return floor.pieces;
}
