/**
 * Water: a noise field over a floor, cut at the water level, plus a pool in the rooms where water
 * gathers (`poolRooms`). The wet cells are traced into closed outlines, then roughened and smoothed
 * into shorelines. The renderer clips them to the floors.
 */

import type { CellPoint, DungeonDoor, DungeonRoom, DungeonTerrain, DungeonWater } from './model';
import { type Rng, chance, floorStream, int, stream } from './rng';
import { HOLE_KINDS } from './terrain/catalog';
import { traceLoops } from './water/contour';
import { fractalNoise } from './water/noise';
import { chaikin, jitter, resample, wobble } from './water/smooth';
import { holdsCell } from './geometry';
import { type CellGrid, DRY, WET, floorCells, floorMarks, gridAround, indexOf, wetGrid } from './water/wetGrid';

export interface WaterResult {
  water: DungeonWater[];
  waterCells: CellPoint[];
}

export interface WaterRequest {
  /** 0..1: the share of the noise range under water. */
  level: number;
  /** Rooms with a pool (`poolRooms`). */
  pools: ReadonlySet<number>;
  /** Floor cells that stay dry, as `x,y`: what terrain fills (water never runs over a chasm or a platform). */
  dry?: ReadonlySet<string>;
  /** Only these rooms take water from the level (a cave's basins and the rooms its streams run through); unset, every room. */
  rooms?: ReadonlySet<number>;
  /** The fewest corners a shoreline has, so a pool of one cell is drawn round (a cave's); unset, three. */
  shoreCorners?: number;
}

/**
 * Water gathers where the floor falls away: in rooms steps lead down into, and in dead ends; only
 * in the rooms `mayPool` allows (a built theme's pools are its rooms' reasons).
 */
export function poolRooms(rng: Rng, rooms: readonly DungeonRoom[], doors: readonly DungeonDoor[], poolChance: number, mayPool: (id: number) => boolean = () => true): Set<number> {
  const out = new Set<number>();
  if (poolChance <= 0) return out;
  for (const room of rooms) {
    if (room.kind !== 'room' || !mayPool(room.id)) continue;
    const own = doors.filter((door) => door.from === room.id || door.to === room.id);
    const below = own.some((door) => door.kind === 'steps' && (door.descends ? door.to : door.from) === room.id);
    const p = poolChance * (below ? 2 : 1) * (own.length <= 1 ? 1.5 : 1);
    if (chance(rng, Math.min(0.9, p))) out.add(room.id);
  }
  return out;
}

/** Terrain no liquid lies in or beside, as it would drain away: every hole (murder holes too) and pits; lava and acid besides, as they never meet water. */
const NO_WATER_BESIDE: ReadonlySet<string> = new Set([...HOLE_KINDS, 'pit']);

/** The cells within a cell of a hole, pit or shaft, or of a lava or acid channel, as `x,y`: water keeps off them. */
export function drainCells(terrain: readonly DungeonTerrain[]): Set<string> {
  const out = new Set<string>();
  for (const piece of terrain) {
    const molten = piece.traits.hazard === 'lava' || piece.traits.hazard === 'acid';
    if (!NO_WATER_BESIDE.has(piece.kind) && !molten) continue;
    for (const c of piece.cells) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.add(`${c.x + dx},${c.y + dy}`);
  }
  return out;
}

/** The GM's level, else the tags', else a roll of 0 to 0.4 in steps of 0.1. */
export function chooseWaterLevel(seed: number, requested: number | undefined, fromTags: number | null): number {
  if (requested !== undefined) return Math.min(1, Math.max(0, requested));
  if (fromTags !== null) return fromTags;
  return int(stream(seed, 'water', 'level'), 0, 4) / 10;
}

function noiseFloor(rng: Rng, grid: CellGrid, floors: readonly CellPoint[], level: number, wet: Uint8Array): void {
  const size = Math.max(grid.w, grid.h);
  const noise = fractalNoise(rng, Math.round(Math.log2(size)), 0.5 + rng() * 0.3, size / 2);
  const values = floors.map((c) => noise(c.x + 0.5, c.y + 0.5));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const threshold = min + (max - min) * level;
  floors.forEach((c, k) => {
    if ((values[k] ?? Infinity) < threshold) wet[indexOf(grid, c.x, c.y)] = WET;
  });
}

function poolIn(room: DungeonRoom, grid: CellGrid, wet: Uint8Array): void {
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  const rx = Math.max(0.8, room.w * 0.35);
  const ry = Math.max(0.8, room.h * 0.35);
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 && holdsCell(room, x, y)) wet[indexOf(grid, x, y)] = WET;
    }
  }
}

function shoreline(rng: Rng, loop: readonly CellPoint[], least?: number): CellPoint[] {
  const rough = resample(jitter(rng, loop, 0.3), 1);
  return wobble(rng, resample(chaikin(rough, 2), 0.5, least), 0.3);
}

export function placeWater(seed: number, floor: number, rooms: readonly DungeonRoom[], request: WaterRequest): WaterResult {
  if (rooms.length === 0 || (request.level <= 0 && request.pools.size === 0)) return { water: [], waterCells: [] };
  const rng = floorStream(seed, 'water', floor);
  const grid = gridAround(rooms);
  const floors = floorCells(rooms);
  const wetFloor = new Uint8Array(grid.w * grid.h);
  const { rooms: only } = request;
  if (request.level > 0) noiseFloor(rng, grid, only ? floorCells(rooms.filter((room) => only.has(room.id))) : floors, request.level, wetFloor);
  rooms.filter((room) => request.pools.has(room.id)).forEach((room) => poolIn(room, grid, wetFloor));
  const keepDry = new Uint8Array(grid.w * grid.h);
  // Rooms that take no water stay dry, also where water closes round them (a cave's chamber swelling round a tunnel).
  if (only) for (const c of floorCells(rooms.filter((room) => !only.has(room.id)))) keepDry[indexOf(grid, c.x, c.y)] = 1;
  for (const key of request.dry ?? []) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const i = indexOf(grid, x, y);
    if (i < 0) continue;
    wetFloor[i] = DRY;
    keepDry[i] = 1;
  }
  const wet = wetGrid(grid, floorMarks(grid, rooms), wetFloor, keepDry);
  const waterCells = floors.filter((c) => wet[indexOf(grid, c.x, c.y)] === WET);
  if (waterCells.length === 0) return { water: [], waterCells: [] };
  const water = traceLoops(grid, wet).map((loop) => ({ outline: shoreline(rng, loop, request.shoreCorners) }));
  return { water, waterCells };
}
