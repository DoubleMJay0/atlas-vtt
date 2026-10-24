import { describe, expect, it } from 'vitest';
import { cellKey } from '../../../src/app/dungeons/geometry';
import type { CellPoint, DungeonDoor, DungeonRoom } from '../../../src/app/dungeons/model';
import { tapestry } from '../../../src/app/dungeons/props/arrange';
import { aroundParent, onShore } from '../../../src/app/dungeons/props/arrangeGroups';
import { atBackWall, againstWall, atCentre, inCorner, inRows, onWall } from '../../../src/app/dungeons/props/cellVerbs';
import { type FurnishSpace, furnishSpace, placePiece } from '../../../src/app/dungeons/props/furnishSpace';
import { ALL_PROP_KINDS, type PropKind } from '../../../src/app/dungeons/props/propKinds';
import { frameOf } from '../../../src/app/dungeons/props/roomFrame';
import { edgeSpots, roomSpace } from '../../../src/app/dungeons/props/space';
import { rngFrom } from '../../../src/app/dungeons/rng';
import { draft } from '../../../src/app/dungeons/terrain/catalog';
import { FloorTerrain } from '../../../src/app/dungeons/terrain/floorTerrain';
import { reserveLanes } from '../../../src/app/dungeons/terrain/roomLanes';
import { room } from './plannedFloorFixtures';

/** A room of `w` × `h` cells entered from the south (axis up), with a door in the middle of its south wall and, if asked, one in its north wall. */
function furnished(w: number, h: number, options: { seed?: number; rotunda?: boolean; north?: boolean; offered?: ReadonlySet<PropKind>; placeAllowed?: (kind: PropKind, at: CellPoint) => boolean } = {}): FurnishSpace {
  const r: DungeonRoom = room(0, { x: 0, y: 0, w, h, axis: { x: 0, y: -1 }, rotunda: options.rotunda ?? false });
  const mid = Math.floor(w / 2);
  const doors: DungeonDoor[] = [{ x: mid, y: h, dir: { x: 0, y: -1 }, kind: 'door', from: null, to: 0 }];
  if (options.north) doors.push({ x: mid, y: -1, dir: { x: 0, y: -1 }, kind: 'door', from: 0, to: 1 });
  const floor = new FloorTerrain(0, { rooms: [r], doors, stairs: [], columns: [] });
  const rc = floor.room(0)!;
  const clear = new Set(rc.needed.map((c) => cellKey(c.x, c.y)));
  return furnishSpace({
    floor,
    cells: rc,
    space: roomSpace(frameOf(r), clear, []),
    rng: rngFrom(options.seed ?? 1),
    offered: options.offered ?? ALL_PROP_KINDS,
    doors,
    ...(options.placeAllowed && { placeAllowed: options.placeAllowed }),
  });
}

const placedCells = (fs: FurnishSpace): CellPoint[] => fs.placed.flatMap((p) => [...p.cells]);

/** Whether the room's walkable cells fall apart, or a cell it must keep reachable is blocked or cut off. */
function splits(fs: FurnishSpace, w: number, h: number): boolean {
  const walk = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && !fs.cells.isBlocked({ x, y });
  const cells: CellPoint[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (walk(x, y)) cells.push({ x, y });
  const seen = new Set([cellKey(cells[0]!.x, cells[0]!.y)]);
  const queue = [cells[0]!];
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const key = cellKey(c.x + dx, c.y + dy);
      if (!seen.has(key) && walk(c.x + dx, c.y + dy)) {
        seen.add(key);
        queue.push({ x: c.x + dx, y: c.y + dy });
      }
    }
  }
  return seen.size !== cells.length || fs.cells.needed.some((c) => !seen.has(cellKey(c.x, c.y)));
}

describe('cell furniture', () => {
  it('stands a bed head to the wall with both long sides free', () => {
    const fs = furnished(5, 5);
    const bed = againstWall(fs, 'bed', ['left', 'right', 'back']);
    expect(bed).not.toBeNull();
    const piece = fs.placed[0]!;
    expect(piece.cells).toHaveLength(2);
    // Its head lies on a wall cell, its foot one cell into the room.
    const onWall = (c: CellPoint): boolean => c.x === 0 || c.x === 4 || c.y === 0 || c.y === 4;
    expect(piece.cells.some(onWall)).toBe(true);
    expect(piece.clear.length).toBeGreaterThanOrEqual(2);
    for (const c of piece.clear) expect(fs.cells.isBlocked(c)).toBe(false);
  });

  it('rings a table with free cells and seats chairs in them', () => {
    const fs = furnished(6, 6);
    expect(atCentre(fs, 'table')).not.toBeNull();
    const table = fs.placed[0]!;
    const chairs = aroundParent(fs, 'chair', table, 4);
    expect(chairs.length).toBeGreaterThanOrEqual(2);
    for (const c of table.clear) expect(fs.cells.isBlocked(c)).toBe(false);
  });

  it('keeps lanes between doors and stairs straight and clear', () => {
    const fs = furnished(7, 7, { north: true });
    reserveLanes(fs.cells);
    inRows(fs, 'bunk', 6);
    const taken = new Set(placedCells(fs).map((c) => cellKey(c.x, c.y)));
    // The lane from the south door to the north one runs straight up the middle column.
    for (let y = 0; y < 7; y++) expect(taken.has(cellKey(3, y)), `cell 3,${y}`).toBe(false);
  });

  it('places no wall or back-wall piece in a round room or across a door', () => {
    const round = furnished(7, 7, { rotunda: true });
    expect(atBackWall(round, 'shelves')).toBeNull();
    expect(againstWall(round, 'bed', ['left', 'right', 'back', 'near'])).toBeNull();
    expect(onWall(round, 'portrait', 3)).toEqual([]);
    const doors = furnished(3, 3, { north: true });
    for (let k = 0; k < 6; k++) onWall(doors, 'portrait', 1);
    for (const p of doors.placed) {
      // No portrait hangs on the cell before a door.
      expect(p.prop.x === 1.5 && (p.prop.y < 0.5 || p.prop.y > 2.5)).toBe(false);
    }
  });

  it('never splits a room', () => {
    const kinds: PropKind[] = ['bed', 'table', 'shelves', 'bookshelf', 'wardrobe', 'barrel', 'crate', 'desk', 'bunk', 'chest', 'planter', 'armour-stand'];
    for (let seed = 1; seed <= 200; seed++) {
      const w = 4 + (seed % 5);
      const h = 4 + (seed % 3);
      const fs = furnished(w, h, { seed, north: true });
      reserveLanes(fs.cells);
      kinds.forEach((kind, k) => {
        const verb = [atCentre, inCorner, atBackWall][k % 3]!;
        verb(fs, kind);
      });
      expect(splits(fs, w, h), `seed ${seed}`).toBe(false);
    }
  });

  it('offers nothing it was not offered', () => {
    const fs = furnished(5, 5, { offered: new Set() });
    expect(placePiece(fs, 'bed', [{ x: 1, y: 1 }, { x: 1, y: 2 }], { x: 0, y: 1 })).toBeNull();
    expect(atCentre(fs, 'barrel')).toBeNull();
    expect(onWall(fs, 'portrait', 2)).toEqual([]);
  });

  it('stretches a long table along the room', () => {
    const fs = furnished(5, 9);
    const [table] = inRows(fs, 'long-table', 1);
    expect(table?.size?.along).toBeGreaterThanOrEqual(3);
    expect(table?.size?.along).toBeLessThanOrEqual(6);
  });

  it('asks the room\'s placeAllowed', () => {
    const veto = { x: 2, y: 2 };
    const fs = furnished(5, 5, { placeAllowed: (_, at) => at.x !== veto.x || at.y !== veto.y });
    atCentre(fs, 'table');
    atCentre(fs, 'crate');
    inCorner(fs, 'hay');
    expect(placedCells(fs).some((c) => c.x === veto.x && c.y === veto.y)).toBe(false);
  });

  it('lays shore pieces only beside liquid', () => {
    const wet = furnished(6, 6);
    wet.floor.place(draft('deep-water', 0, [{ x: 2, y: 2 }, { x: 3, y: 2 }]));
    const crystals = onShore(wet, 'crystals', 3);
    expect(crystals.length).toBeGreaterThan(0);
    for (const p of wet.placed) expect(p.cells.some((c) => Math.abs(c.x - 2.5) + Math.abs(c.y - 2) <= 1.5)).toBe(true);
    expect(onShore(furnished(6, 6), 'crystals', 3)).toEqual([]);
  });
});

describe('room walls', () => {
  it('finds the walls of an L-shaped mask', () => {
    // A 6 × 5 room without its 3 × 2 north-east corner, as a cave's chamber would name its cells.
    const r = room(0, { x: 0, y: 0, w: 6, h: 5 });
    const cells = new Set<string>();
    for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) if (!(x >= 3 && y < 2)) cells.add(cellKey(x, y));
    const space = roomSpace(frameOf(r), new Set(), [], cells);
    for (const spot of edgeSpots(space, 1)) {
      const inner = { x: Math.floor(spot.point.x + spot.inward.x * 0.4), y: Math.floor(spot.point.y + spot.inward.y * 0.4) };
      const outer = { x: Math.floor(spot.point.x - spot.inward.x * 0.6), y: Math.floor(spot.point.y - spot.inward.y * 0.6) };
      expect(cells.has(cellKey(inner.x, inner.y))).toBe(true);
      expect(cells.has(cellKey(outer.x, outer.y))).toBe(false);
    }
    expect(edgeSpots(space, 1)).toHaveLength(22);
  });

  it('hangs a tapestry on the back wall of a mask where its rectangle has none', () => {
    // Axis up: the back wall is the north edge; the mask lacks the north middle cells.
    const r = room(0, { x: 0, y: 0, w: 6, h: 5, axis: { x: 0, y: -1 } });
    const cells = new Set<string>();
    for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) if (!(x >= 2 && x <= 3 && y === 0)) cells.add(cellKey(x, y));
    const [hung] = tapestry(roomSpace(frameOf(r), new Set(), [], cells), []);
    expect(hung).toBeDefined();
    expect(cells.has(cellKey(Math.floor(hung!.x), Math.floor(hung!.y)))).toBe(true);
  });

  it('lists the wall cells of each side of a room', () => {
    const fs = furnished(4, 3);
    expect(fs.cells.wallCells('back').map((c) => c.y)).toEqual([0, 0, 0, 0]);
    expect(fs.cells.wallCells('near').map((c) => c.y)).toEqual([2, 2, 2, 2]);
    expect(fs.cells.wallCells('left').length + fs.cells.wallCells('right').length).toBe(6);
    expect(fs.cells.doorOn('near', { x: 2, y: 2 })).toBe(true);
    expect(fs.cells.doorOn('near', { x: 1, y: 2 })).toBe(false);
  });
});
