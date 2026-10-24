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
import { type Rng, int, shuffled, weighted } from '../rng';
import type { DungeonTag } from '../tags';
import { draft } from './catalog';
import type { FloorTerrain } from './floorTerrain';
import type { RoomCells } from './roomCells';
import { standsApart } from './shapes';

/** A room this many cells or fewer is cramped; larger is open. */
/** Rooms of at least this much floor can hold a fight and get cover unless they are left empty. */
export const FIGHT_AREA = 12;

export const CRAMPED_AREA = 20;

export interface CoverShape {
  kind: TerrainKind;
  /** Rows deep and columns wide in the room's frame. */
  di: number;
  dj: number;
}

/** The low pieces a cramped room scatters, by the dungeon's tags. */
function halfCover(tags: ReadonlySet<DungeonTag>): (readonly [CoverShape, number])[] {
  return [
    [{ kind: 'crates', di: 1, dj: 1 }, 3],
    [{ kind: 'table', di: 1, dj: 2 }, 1],
    [{ kind: 'table', di: 2, dj: 1 }, 0.5],
    [{ kind: 'rubble-heap', di: 1, dj: 1 }, tags.has('crumbling') ? 4 : 1],
    [{ kind: 'rubble-heap', di: 1, dj: 2 }, tags.has('crumbling') ? 2 : 0.3],
    [{ kind: 'low-wall', di: 1, dj: 2 }, 1.5],
  ];
}

function negate(d: CellDir): CellDir {
  return dir(-d.x, -d.y);
}

/** Places a piece of `shape` with its corner at (i, j) if the room allows it and it stands apart from the others. */
export function tryShape(floor: FloorTerrain, rc: RoomCells, shape: CoverShape, i: number, j: number): boolean {
  const cells = rc.block(i, j, shape.di, shape.dj);
  if (!standsApart(rc, cells, floor.takenCells())) return false;
  return floor.place(draft(shape.kind, rc.room.id, cells, { facing: negate(rc.axis) })) !== null;
}

/** Up to `count` pieces drawn from `shapes` (of the kinds `allows` lets in, where given), each at a random free place. */
export function scatterCover(floor: FloorTerrain, rc: RoomCells, rng: Rng, count: number, tags: ReadonlySet<DungeonTag>, allows: (kind: TerrainKind) => boolean = () => true): number {
  const shapes = halfCover(tags).filter(([shape, w]) => w > 0 && allows(shape.kind));
  if (shapes.length === 0) return 0;
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
function mirroredPair(floor: FloorTerrain, rc: RoomCells, shape: CoverShape, i: number, inset: number): boolean {
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
export function pillars(floor: FloorTerrain, rc: RoomCells, rng: Rng): boolean {
  const size = rc.width >= 8 && rc.depth >= 7 ? 2 : 1;
  const shape: CoverShape = { kind: 'pillar', di: size, dj: size };
  const rows = shuffled(rng, [Math.floor(rc.depth / 3), Math.floor(rc.depth / 2), Math.floor((rc.depth * 2) / 3) - size + 1]);
  const insets = rc.width >= 7 ? [Math.floor(rc.width / 5), 1] : [1];
  return rows.some((i) => insets.some((inset) => mirroredPair(floor, rc, shape, Math.max(1, i), inset)));
}

/** Whether the room holds a piece that gives cover. */
export function hasCover(floor: FloorTerrain, rc: RoomCells): boolean {
  return floor.inRoom(rc.room.id).some((p) => p.traits.cover !== undefined);
}

/** A last piece of low cover where the room has none yet (`kind`, else what the tags suggest): tried at every free cell. */
export function ensureCover(floor: FloorTerrain, rc: RoomCells, tags: ReadonlySet<DungeonTag>, kind: TerrainKind = tags.has('crumbling') ? 'rubble-heap' : 'crates'): void {
  if (hasCover(floor, rc)) return;
  for (let i = 0; i < rc.depth; i++) {
    for (let j = 0; j < rc.width; j++) {
      if (floor.place(draft(kind, rc.room.id, rc.block(i, j, 1, 1), { facing: negate(rc.axis) })) !== null) return;
    }
  }
}
