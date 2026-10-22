/**
 * Water: a noise field over the dungeon, cut at the water level, plus a pool in every room the
 * plan marks for one. The wet cells are traced into closed outlines, then roughened and smoothed
 * into shorelines. The renderer clips them to the floors.
 */

import type { CellPoint, DungeonRoom, DungeonWater } from './model';
import { type Rng, int, stream } from './rng';
import { traceLoops } from './water/contour';
import { fractalNoise } from './water/noise';
import { chaikin, jitter, resample, wobble } from './water/smooth';
import { type CellGrid, WET, floorCells, gridAround, indexOf, wetGrid } from './water/wetGrid';

export interface WaterResult {
  water: DungeonWater[];
  waterCells: CellPoint[];
}

export interface WaterRequest {
  /** 0..1: the share of the noise range under water. */
  level: number;
  /** Rooms the plan puts a pool in (`RoomMarks.water`). */
  pools: ReadonlySet<number>;
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
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) wet[indexOf(grid, x, y)] = WET;
    }
  }
}

function shoreline(rng: Rng, loop: readonly CellPoint[]): CellPoint[] {
  const rough = resample(jitter(rng, loop, 0.3), 1);
  return wobble(rng, resample(chaikin(rough, 2), 0.5), 0.3);
}

export function placeWater(seed: number, rooms: readonly DungeonRoom[], request: WaterRequest): WaterResult {
  if (rooms.length === 0 || (request.level <= 0 && request.pools.size === 0)) return { water: [], waterCells: [] };
  const rng = stream(seed, 'water');
  const grid = gridAround(rooms);
  const floors = floorCells(rooms);
  const wetFloor = new Uint8Array(grid.w * grid.h);
  if (request.level > 0) noiseFloor(rng, grid, floors, request.level, wetFloor);
  rooms.filter((room) => request.pools.has(room.id)).forEach((room) => poolIn(room, grid, wetFloor));
  const wet = wetGrid(grid, rooms, wetFloor);
  const waterCells = floors.filter((c) => wet[indexOf(grid, c.x, c.y)] === WET);
  if (waterCells.length === 0) return { water: [], waterCells: [] };
  const water = traceLoops(grid, wet).map((loop) => ({ outline: shoreline(rng, loop) }));
  return { water, waterCells };
}
