/**
 * Every floor's terrain, placed together so holes line up between floors. First the gallery over
 * the boss arena (it opens the floor above it), then each floor from the top down: the arena and
 * the five-room stages, a shaft now and then, the hazards of rooms whose type has a reason for one,
 * then each room by its type's recipe. The rooms that stand empty stay empty but for what passes
 * through them (a hole, the floor under one).
 */

import type { CellPoint, DungeonRoom, DungeonTerrain } from '../model';
import { cellKey } from '../geometry';
import type { DungeonTag } from '../tags';
import type { ThemeContext } from '../themes/themes';
import { furnishArena } from './arena';
import { placeBreakdown } from './cavern/breakdown';
import { withoutItsHazard } from './cavern/unnamedRoom';
import { floorTextures } from './cavern/caveTextures';
import { draft } from './catalog';
import { type FloorPlan, FloorTerrain } from './floorTerrain';
import { furnishStage } from './stages';
import { furnishTypedArena } from './typeArena';
import { placeTypeHazard } from './typeHazards';
import { type TypedRoom, furnishTypedRoom } from './typeTerrain';
import { galleryOverArena, shaftDown } from './vertical';
import { type TerrainCave, type TerrainWork, terrainWork } from './work';

export interface TerrainFloorInput extends FloorPlan {
  /** Normal rooms left without furniture. */
  empty: ReadonlySet<number>;
  /** The rooms the theme typed, furnished by their recipes. */
  types?: ReadonlyMap<number, TypedRoom>;
}

/** The hazards of typed rooms whose types have a reason for one; the rooms that took one. */
function placeTypeHazards(work: TerrainWork, k: number, rooms: readonly DungeonRoom[]): Set<number> {
  const out = new Set<number>();
  for (const room of rooms) {
    const typed = work.typed(k, room.id);
    const rc = work.floors[k]?.room(room.id);
    if (!typed || !rc || room.boss || room.stage || room.wing !== 'regular' || work.floors[k]?.inRoom(room.id).length) continue;
    if (placeTypeHazard(work, k, rc, typed.spec, work.rng(k, `hazard:${room.id}`))) out.add(room.id);
  }
  return out;
}

function furnishFloor(work: TerrainWork, k: number, input: TerrainFloorInput): void {
  const rooms = input.rooms.filter((room) => room.kind === 'room');
  for (const room of rooms) {
    const rc = work.floors[k]?.room(room.id);
    const rng = work.rng(k, `main:${room.id}`);
    if (!rc) continue;
    const typed = input.types?.get(room.id);
    const arena = room.boss || room.stage === 'climax';
    if (room.stage && room.stage !== 'climax') furnishStage(work, k, rc, rng, room.stage, work.tags, typed);
    else if (arena && typed) furnishTypedArena(work, k, rc, rng, typed);
    else if (arena) furnishArena(work, k, rc, rng, work.tags);
  }
  shaftDown(work, k, work.rng(k, 'shaft'));
  const hazarded = placeTypeHazards(work, k, rooms);
  const types = new Map(input.types);
  for (const room of rooms) {
    const typed = types.get(room.id);
    if (typed && !room.stage && !hazarded.has(room.id)) types.set(room.id, withoutItsHazard(work, room, typed));
  }
  if (work.cave) for (const room of rooms) caveGround(work, k, room.id, 'breakdown');
  for (const room of rooms) {
    if (room.boss || room.stage || input.empty.has(room.id)) continue;
    const typed = types.get(room.id);
    const rc = work.floors[k]?.room(room.id);
    if (typed && rc) furnishTypedRoom(work, k, rc, typed.spec, typed.context, hazarded.has(room.id));
  }
  if (work.cave) for (const room of rooms) caveGround(work, k, room.id, 'textures');
}

/** A cave room's breakdown (before its furniture, which keeps off it), or its floor's textures (after). */
function caveGround(work: TerrainWork, k: number, room: number, what: 'breakdown' | 'textures'): void {
  const rc = work.floors[k]?.room(room);
  if (!rc) return;
  if (what === 'breakdown') placeBreakdown(work, k, rc, work.rng(k, `breakdown:${room}`));
  else floorTextures(work, k, rc, work.rng(k, `textures:${room}`));
}

/** The terrain of every floor, as builders that still take the shallow water once it is known (`addShallowWater`). */
export function planTerrain(seed: number, floors: readonly TerrainFloorInput[], tags: ReadonlySet<DungeonTag>, theme: ThemeContext, cave?: TerrainCave): FloorTerrain[] {
  const builders = floors.map((floor, index) => new FloorTerrain(index, floor));
  const work = terrainWork(seed, builders, tags, theme, { types: floors.map((floor) => floor.types), empty: floors.map((floor) => floor.empty) }, cave);
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
