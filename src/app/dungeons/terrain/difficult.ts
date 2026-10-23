/**
 * Difficult ground that shapes a fight (Map-Fu): rows of pews in a temple's hall with an aisle
 * down the middle, fields of loose rubble where the dungeon crumbles (big chunks are cover, loose
 * scatter is difficult), broken floor where the ground has shifted. All of it can be walked.
 */

import type { CellPoint } from '../model';
import { type Rng, chance, int } from '../rng';
import type { DungeonTag } from '../tags';
import { draft } from './catalog';
import type { FloorTerrain } from './floorTerrain';
import type { RoomCells } from './roomCells';
import { grownBlob } from './shapes';

/** Pews across the room every other row from the second, an aisle down the middle. */
export function pews(floor: FloorTerrain, rc: RoomCells): boolean {
  if (rc.depth < 5 || rc.width < 5) return false;
  const aisle = new Set([Math.floor((rc.width - 1) / 2), Math.ceil((rc.width - 1) / 2)]);
  const cells: CellPoint[] = [];
  for (let i = 1; i < rc.depth - 2; i += 2) {
    for (let j = 1; j < rc.width - 1; j++) {
      const c = rc.cell(i, j);
      if (!aisle.has(j) && rc.isFree(c)) cells.push(c);
    }
  }
  if (cells.length < 4) return false;
  return floor.place(draft('pews', rc.room.id, cells)) !== null;
}

/** A field of loose rubble or broken floor, three to six cells grown from a free cell. */
export function roughGround(floor: FloorTerrain, rc: RoomCells, rng: Rng, kind: 'rubble-field' | 'broken-floor'): boolean {
  for (let tries = 0; tries < 6; tries++) {
    const start = rc.cell(int(rng, 0, rc.depth - 1), int(rng, 0, rc.width - 1));
    const cells = grownBlob(rc, rng, start, int(rng, 3, kind === 'rubble-field' ? 6 : 4));
    if (cells.length >= 3 && floor.place(draft(kind, rc.room.id, cells)) !== null) return true;
  }
  return false;
}

/** Difficult ground for a room by the dungeon's tags; the hall of a temple fills with pews. */
export function difficultGround(floor: FloorTerrain, rc: RoomCells, rng: Rng, tags: ReadonlySet<DungeonTag>, hall: boolean): void {
  if (tags.has('temple') && rc.floorCount >= 25 && chance(rng, hall ? 0.8 : 0.35) && pews(floor, rc)) return;
  const rubble = tags.has('crumbling') ? 0.4 : 0.1;
  const broken = tags.has('crumbling') || tags.has('deep') ? 0.18 : 0.06;
  const roll = rng();
  if (roll < rubble) roughGround(floor, rc, rng, 'rubble-field');
  else if (roll < rubble + broken) roughGround(floor, rc, rng, 'broken-floor');
}
