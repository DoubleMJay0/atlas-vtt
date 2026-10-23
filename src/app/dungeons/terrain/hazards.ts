/**
 * Hazards a party sees at a glance and positions around (Terrain principle 3): chasms, channels of
 * lava, acid or water, deep water and pits. A hazard never cuts a room in two: a band from wall to
 * wall has a bridge across it (one cell wide, Terrain principle 4) and, where the room is wide
 * enough, stops short of one wall so a longer way leads round it. A chasm on a floor with floors
 * below opens onto them (`holes.ts`).
 */

import type { CellPoint } from '../model';
import { type Rng, chance, int, pick, shuffled, weighted } from '../rng';
import type { DungeonTag } from '../tags';
import { draft } from './catalog';
import { cutHole, dropBelow } from './holes';
import type { RoomCells } from './roomCells';
import { type Band, bandAcross, jaggedBlock } from './shapes';
import type { TerrainWork } from './work';

export type HazardChoice = 'chasm' | 'channel' | 'deep-water' | 'pit';

/** How likely each hazard is, by the dungeon's tags. */
export function hazardWeights(tags: ReadonlySet<DungeonTag>): (readonly [HazardChoice, number])[] {
  const wet = tags.has('wet') || tags.has('flooded');
  return [
    ['chasm', tags.has('crumbling') || tags.has('deep') ? 5 : 3],
    ['channel', 1.5],
    ['deep-water', tags.has('dry') ? 0 : wet ? 3 : 0.7],
    ['pit', 1.5],
  ];
}

type Substance = { hazard: 'lava' | 'acid' | 'deep-water'; name: string };

/** What runs in a channel: water in a wet dungeon, else lava or acid. */
function substance(rng: Rng, tags: ReadonlySet<DungeonTag>): Substance {
  if ((tags.has('wet') || tags.has('flooded')) && !tags.has('dry')) return { hazard: 'deep-water', name: 'dungeon.terrain.waterChannel' };
  return weighted<Substance>(rng, [
    [{ hazard: 'lava', name: 'dungeon.terrain.lavaChannel' }, 2],
    [{ hazard: 'acid', name: 'dungeon.terrain.acidChannel' }, 1],
  ]);
}

/** Bands across the room to try, each with its bridge where the way through the room's middle crosses it. */
function bands(rc: RoomCells, rng: Rng, thickness: number, jagged: boolean): Band[] {
  if (rc.depth < 5 || rc.width < 3) return [];
  const rows = shuffled(rng, Array.from({ length: rc.depth - 4 }, (_, k) => k + 2)).filter((i0) => i0 + thickness <= rc.depth - 2);
  const middle = (rc.width - 1) / 2;
  const columns = [Math.floor(middle), Math.ceil(middle), Math.floor(middle) - 1, Math.ceil(middle) + 1].filter((j, k, all) => j >= 0 && j < rc.width && all.indexOf(j) === k);
  const gapAt = rc.width >= 5 && chance(rng, 0.6) ? pick<0 | 1>(rng, [0, 1]) : -1;
  return rows.flatMap((i0) => columns.map((bridgeJ) => bandAcross(rc, rng, i0, thickness, { jagged, gapAt, bridgeJ })));
}

/** The cells at both ends of a bridge, which stay clear so it always leads somewhere. */
function landings(rc: RoomCells, band: Band): CellPoint[] {
  const step = rc.axis;
  const first = band.bridge[0];
  const last = band.bridge[band.bridge.length - 1];
  if (!first || !last) return [];
  const along = band.bridge.length > 1 ? { x: Math.sign(last.x - first.x), y: Math.sign(last.y - first.y) } : step;
  return [
    { x: first.x - along.x, y: first.y - along.y },
    { x: last.x + along.x, y: last.y + along.y },
  ];
}

function bridgeOver(work: TerrainWork, k: number, rc: RoomCells, band: Band, spans: number, name: string): void {
  const floor = work.floors[k];
  if (!floor || band.bridge.length === 0) return;
  floor.addBridge(draft('bridge', rc.room.id, band.bridge, { facing: rc.axis, name }), spans);
  rc.keepClear(landings(rc, band));
}

/** Blobs inside the room, a cell clear of its walls, from large to small, up to `each` places of each size. */
function blobs(rc: RoomCells, rng: Rng, sizes: readonly (readonly [number, number])[], each = 6): CellPoint[][] {
  return sizes.flatMap(([di, dj]) => {
    if (rc.depth < di + 2 || rc.width < dj + 2) return [];
    const spots = Array.from({ length: (rc.depth - di - 1) * (rc.width - dj - 1) }, (_, k) => [1 + (k % (rc.depth - di - 1)), 1 + Math.floor(k / (rc.depth - di - 1))] as const);
    return shuffled(rng, spots).slice(0, each).map(([i, j]) => jaggedBlock(rc, rng, i, j, di, dj));
  });
}

/** A blob's bridge: straight along the room's axis through its middle column, where the blob is three cells deep there. */
function blobBridge(rc: RoomCells, cells: readonly CellPoint[]): Band {
  const own = new Set(cells.map((c) => `${c.x},${c.y}`));
  for (let j = 0; j < rc.width; j++) {
    const column = Array.from({ length: rc.depth }, (_, i) => rc.cell(i, j)).filter((c) => own.has(`${c.x},${c.y}`));
    if (column.length < 3) continue;
    const middle = cells.reduce((sum, c) => sum + (c.x * rc.across.x + c.y * rc.across.y), 0) / cells.length;
    const at = column[0]!.x * rc.across.x + column[0]!.y * rc.across.y;
    if (Math.abs(at - middle) <= 0.5) return { cells: [...cells], bridge: column };
  }
  return { cells: [...cells], bridge: [] };
}

/** Whether cells may open onto the floor below: every one over the floor of one regular room there. */
function overRoomBelow(work: TerrainWork, k: number, cells: readonly CellPoint[]): boolean {
  const below = work.floors[k + 1];
  return !below || below.roomHolding(cells)?.room.wing === 'regular';
}

function placeChasm(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): boolean {
  const thickness = rc.depth >= 8 && chance(rng, 0.5) ? 2 : 1;
  const tryBand = (band: Band): boolean => {
    if (!overRoomBelow(work, k, band.cells) || !rc.allows(band.cells, 'block', band.bridge)) return false;
    const drop = dropBelow(work, k, band.cells, rng);
    const id = drop && cutHole(work, k, rc, 'chasm', band.cells, drop, { bridge: band.bridge });
    if (id === null || id === undefined) return false;
    if (band.bridge.length > 0) bridgeOver(work, k, rc, band, id, 'dungeon.terrain.ropeBridge');
    return true;
  };
  const rifts = bands(rc, rng, thickness, true).slice(0, 12);
  const holes = blobs(rc, rng, [[3, 3], [4, 3], [3, 4], [2, 3], [3, 2], [2, 2]], 12).map((cells) => blobBridge(rc, cells));
  const order = chance(rng, 0.5) ? [...rifts, ...holes] : [...holes, ...rifts];
  return order.some(tryBand);
}

function placeChannel(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): boolean {
  const { hazard, name } = substance(rng, work.tags);
  const floor = work.floors[k];
  for (const band of bands(rc, rng, 1, false).slice(0, 12)) {
    const id = floor?.place(draft('channel', rc.room.id, band.cells, { name, traits: { hazard }, facing: rc.across }), band.bridge);
    if (id === null || id === undefined) continue;
    bridgeOver(work, k, rc, band, id, 'dungeon.terrain.stoneBridge');
    return true;
  }
  return false;
}

function placePool(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): boolean {
  const floor = work.floors[k];
  return blobs(rc, rng, [[3, 3], [2, 3], [3, 2], [2, 2]]).some((cells) => floor?.place(draft('deep-water', rc.room.id, cells)) != null);
}

/** One pit, or two flanking the way through the room. */
function placePits(work: TerrainWork, k: number, rc: RoomCells, rng: Rng): boolean {
  const floor = work.floors[k];
  if (!floor || rc.depth < 3 || rc.width < 3) return false;
  const size = rc.depth >= 6 && rc.width >= 6 && chance(rng, 0.4) ? 2 : 1;
  const i = int(rng, 1, Math.max(1, rc.depth - size - 1));
  if (size === 1 && rc.width >= 5 && chance(rng, 0.5)) {
    const pair = [rc.block(i, 1, 1, 1), rc.block(i, rc.width - 2, 1, 1)];
    if (pair.every((cells) => rc.allows(cells, 'block'))) {
      pair.forEach((cells) => floor.place(draft('pit', rc.room.id, cells)));
      return true;
    }
  }
  return blobs(rc, rng, [[size, size]]).some((cells) => floor.place(draft('pit', rc.room.id, cells)) !== null);
}

/** One hazard of `choice` in the room, else of another kind that fits; false where none does. */
export function placeHazard(work: TerrainWork, k: number, rc: RoomCells, rng: Rng, choice: HazardChoice): boolean {
  const order: HazardChoice[] = [choice, ...(['chasm', 'channel', 'pit', 'deep-water'] as const).filter((c) => c !== choice)];
  const allowed = new Set(hazardWeights(work.tags).filter(([, w]) => w > 0).map(([c]) => c));
  return order.filter((c) => allowed.has(c)).some((c) => {
    switch (c) {
      case 'chasm':
        return placeChasm(work, k, rc, rng);
      case 'channel':
        return placeChannel(work, k, rc, rng);
      case 'deep-water':
        return placePool(work, k, rc, rng);
      case 'pit':
        return placePits(work, k, rc, rng);
    }
  });
}
