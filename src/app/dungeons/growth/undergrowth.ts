/**
 * Undergrowth too thick to walk through freely, as terrain (difficult, never blocking): brambles,
 * thick ferns or tangled roots in some rooms of an overgrown dungeon, a clump of two to six whole
 * cells grown out from a wall, the more often the more light the room gets. Placed after the
 * water and before the furniture, which keeps off it. Never by a stairwell, a doorway or lava.
 */

import type { CellPoint, DungeonTerrain } from '../model';
import { cellKey } from '../geometry';
import { chance, floorStream, int, type Rng, weighted } from '../rng';
import { draft } from '../terrain/catalog';
import { FIGHT_AREA } from '../terrain/placeTerrain';
import type { FloorTerrain } from '../terrain/floorTerrain';
import type { RoomCells } from '../terrain/roomCells';
import type { Flora, UndergrowthKind } from './flora';
import { GrowthSpace } from './growthSpace';
import { roomLight } from './placeGrowth';

/** Undergrowth that wants light: brambles and ferns; roots grow in the dark. */
const GREEN: Readonly<Record<UndergrowthKind, boolean>> = { brambles: true, thicket: true, 'tangled-roots': false };

function clump(rng: Rng, rc: RoomCells, start: CellPoint, size: number, fits: (c: CellPoint) => boolean): CellPoint[] {
  const cells = [start];
  const seen = new Set([cellKey(start.x, start.y)]);
  while (cells.length < size) {
    const options = cells.flatMap((c) => [{ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 }]).filter((c) => !seen.has(cellKey(c.x, c.y)) && rc.isFree(c) && fits(c));
    if (!options.length) break;
    const next = options[Math.floor(rng() * options.length)]!;
    seen.add(cellKey(next.x, next.y));
    cells.push(next);
  }
  return cells;
}

/** Adds the floor's undergrowth to its terrain; returns every piece. */
export function addUndergrowth(seed: number, floor: FloorTerrain, waterCells: readonly CellPoint[], flora: Flora | null): DungeonTerrain[] {
  if (!flora?.rich) return floor.pieces;
  const { plan } = floor;
  const space = new GrowthSpace({ ...plan, props: [], terrain: floor.pieces, waterCells });
  const light = roomLight({ rooms: plan.rooms, doors: plan.doors, floor: floor.index });
  for (const room of plan.rooms) {
    const rc = floor.room(room.id);
    if (!rc || rc.floorCount < FIGHT_AREA || room.stage !== undefined) continue;
    const rng = floorStream(seed, 'growth', floor.index, `undergrowth:${room.id}`);
    const l = light[room.id] ?? 0;
    if (!chance(rng, 0.2 + 0.4 * l)) continue;
    const clumps = rc.floorCount > 30 && chance(rng, 0.4) ? 2 : 1;
    for (let k = 0; k < clumps; k++) {
      const kind = weighted(rng, flora.undergrowth.map(([kind, w]) => [kind, GREEN[kind] ? w * l : w] as const));
      const fits = (c: CellPoint): boolean => !rc.nearStairs(c) && space.forPlant(c);
      const starts: CellPoint[] = [];
      for (let i = 0; i < rc.depth; i++) for (let j = 0; j < rc.width; j++) {
        const c = rc.cell(i, j);
        const byWall = i === 0 || j === 0 || i === rc.depth - 1 || j === rc.width - 1;
        if (byWall && rc.isFree(c) && fits(c)) starts.push(c);
      }
      const start = starts[Math.floor(rng() * starts.length)];
      if (!start) continue;
      const cells = clump(rng, rc, start, Math.min(int(rng, 2, 6), Math.floor(rc.floorCount / 5)), fits);
      if (cells.length >= 2) floor.place(draft(kind, room.id, cells));
    }
  }
  return floor.pieces;
}
