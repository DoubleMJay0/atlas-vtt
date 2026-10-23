/**
 * Cover where a fight can happen (Terrain principles 1, 2 and 8; Map-Fu's "cover wide enough").
 * Cramped rooms get a few low pieces scattered apart (crates, a table, a rubble heap, the
 * theme's altar or sarcophagus): pressure, everyone in reach. Open rooms get few strong features
 * that break long sight lines: a pair of pillars (two cells wide in large rooms, so they cannot
 * be stepped round), staggered wall fragments, a pair of statues. Pieces never touch each other,
 * so every piece reads alone and the ways between them stay a cell wide.
 */

import type { CellDir, TerrainKind } from '../model';
import { dir } from '../geometry';
import { type Rng, chance, int, pick, shuffled, weighted } from '../rng';
import type { DungeonTag } from '../tags';
import { draft } from './catalog';
import type { FloorTerrain } from './floorTerrain';
import type { RoomCells } from './roomCells';
import { standsApart } from './shapes';

/** A room this many cells or fewer is cramped; larger is open. */
export const CRAMPED_AREA = 20;

interface Shape {
  kind: TerrainKind;
  /** Rows deep and columns wide in the room's frame. */
  di: number;
  dj: number;
}

/** The low pieces a cramped room scatters, by the dungeon's theme. */
function halfCover(tags: ReadonlySet<DungeonTag>): (readonly [Shape, number])[] {
  return [
    [{ kind: 'crates', di: 1, dj: 1 }, 3],
    [{ kind: 'table', di: 1, dj: 2 }, tags.has('dwelling') ? 3 : 1],
    [{ kind: 'table', di: 2, dj: 1 }, tags.has('dwelling') ? 2 : 0.5],
    [{ kind: 'rubble-heap', di: 1, dj: 1 }, tags.has('crumbling') ? 4 : 1],
    [{ kind: 'rubble-heap', di: 1, dj: 2 }, tags.has('crumbling') ? 2 : 0.3],
    [{ kind: 'low-wall', di: 1, dj: 2 }, 1.5],
    [{ kind: 'altar', di: 1, dj: 2 }, tags.has('temple') ? 2 : 0],
    [{ kind: 'sarcophagus', di: 2, dj: 1 }, tags.has('tomb') ? 3 : 0],
  ];
}

function negate(d: CellDir): CellDir {
  return dir(-d.x, -d.y);
}

/** Places a piece of `shape` with its corner at (i, j) if the room allows it and it stands apart from the others. */
function tryShape(floor: FloorTerrain, rc: RoomCells, shape: Shape, i: number, j: number): boolean {
  const cells = rc.block(i, j, shape.di, shape.dj);
  if (!standsApart(rc, cells, floor.takenCells())) return false;
  return floor.place(draft(shape.kind, rc.room.id, cells, { facing: negate(rc.axis) })) !== null;
}

/** Up to `count` pieces drawn from `shapes`, each at a random free place. */
export function scatterCover(floor: FloorTerrain, rc: RoomCells, rng: Rng, count: number, tags: ReadonlySet<DungeonTag>): number {
  const shapes = halfCover(tags).filter(([, w]) => w > 0);
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 10; tries++) {
    const shape = weighted(rng, shapes);
    const i = int(rng, 0, rc.depth - shape.di);
    const j = int(rng, 0, rc.width - shape.dj);
    if (tryShape(floor, rc, shape, i, j)) placed++;
  }
  return placed;
}

/** Two of `shape` mirrored across the room's middle at row `i`, `inset` cells from the side walls. */
function mirroredPair(floor: FloorTerrain, rc: RoomCells, shape: Shape, i: number, inset: number): boolean {
  const left = inset;
  const right = rc.width - inset - shape.dj;
  if (right - left < shape.dj + 1) return false;
  const pair = [rc.block(i, left, shape.di, shape.dj), rc.block(i, right, shape.di, shape.dj)];
  const taken = floor.takenCells();
  if (!pair.every((cells) => standsApart(rc, cells, taken) && rc.fits(cells)) || !rc.allows([...pair[0]!, ...pair[1]!], 'block')) return false;
  pair.forEach((cells) => floor.place(draft(shape.kind, rc.room.id, cells, { facing: negate(rc.axis) })));
  return true;
}

/** Pillars in pairs across the room: two cells square where the room is large. */
function pillars(floor: FloorTerrain, rc: RoomCells, rng: Rng): boolean {
  const size = rc.width >= 8 && rc.depth >= 7 ? 2 : 1;
  const shape: Shape = { kind: 'pillar', di: size, dj: size };
  const rows = shuffled(rng, [Math.floor(rc.depth / 3), Math.floor(rc.depth / 2), Math.floor((rc.depth * 2) / 3) - size + 1]);
  const insets = rc.width >= 7 ? [Math.floor(rc.width / 5), 1] : [1];
  return rows.some((i) => insets.some((inset) => mirroredPair(floor, rc, shape, Math.max(1, i), inset)));
}

/** Wall fragments staggered across the way through: one leaning left, one right. */
function fragments(floor: FloorTerrain, rc: RoomCells, rng: Rng): boolean {
  const length = Math.min(3, Math.max(2, Math.floor(rc.width / 3)));
  const shape: Shape = { kind: 'wall-fragment', di: 1, dj: length };
  const first = Math.max(1, Math.floor(rc.depth / 3));
  const second = Math.min(rc.depth - 2, Math.floor((rc.depth * 2) / 3));
  const flip = chance(rng, 0.5);
  const a = tryShape(floor, rc, shape, first, flip ? 1 : rc.width - 1 - length);
  const b = second > first + 1 && tryShape(floor, rc, shape, second, flip ? rc.width - 1 - length : 1);
  return a || b;
}

function statues(floor: FloorTerrain, rc: RoomCells, rng: Rng): boolean {
  const i = pick(rng, [Math.floor(rc.depth / 2), Math.floor(rc.depth / 3)]);
  return mirroredPair(floor, rc, { kind: 'statue', di: 1, dj: 1 }, Math.max(1, i), rc.width >= 6 ? 1 : 0);
}

/** Strong features for an open room: one layout, else the next that fits, else scattered low cover. */
export function openRoomCover(floor: FloorTerrain, rc: RoomCells, rng: Rng, tags: ReadonlySet<DungeonTag>): void {
  const layouts = shuffled(rng, [pillars, pillars, fragments, statues]);
  const done = layouts.some((layout) => layout(floor, rc, rng));
  if (!done || chance(rng, 0.35)) scatterCover(floor, rc, rng, int(rng, 1, 2), tags);
}

/** Cover for a cramped room: one to three low pieces. */
export function crampedCover(floor: FloorTerrain, rc: RoomCells, rng: Rng, tags: ReadonlySet<DungeonTag>): void {
  const area = rc.floorCount;
  scatterCover(floor, rc, rng, 1 + (area >= 16 ? 1 : 0) + (chance(rng, 0.4) ? 1 : 0), tags);
}

/** Whether the room holds a piece that gives cover. */
export function hasCover(floor: FloorTerrain, rc: RoomCells): boolean {
  return floor.inRoom(rc.room.id).some((p) => p.traits.cover !== undefined);
}

/** A last piece of low cover where the room has none yet: tried at every free cell. */
export function ensureCover(floor: FloorTerrain, rc: RoomCells, tags: ReadonlySet<DungeonTag>): void {
  if (hasCover(floor, rc)) return;
  const kind: TerrainKind = tags.has('crumbling') ? 'rubble-heap' : 'crates';
  for (let i = 0; i < rc.depth; i++) {
    for (let j = 0; j < rc.width; j++) {
      if (floor.place(draft(kind, rc.room.id, rc.block(i, j, 1, 1), { facing: negate(rc.axis) })) !== null) return;
    }
  }
}

export type { Shape as CoverShape };
export { tryShape };
