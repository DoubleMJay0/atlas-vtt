/**
 * The boss room as an arena (Terrain principles 1, 5, 6): open, with few strong features. The high
 * ground at the far side (a platform, 10 ft where the room is deep), one objective set piece the
 * GM can use beyond hit points (three statues, a central altar, a ring of standing stones, or four
 * pillars), wide cover that breaks the sight line from the door to the platform, and a hazard
 * where it fits (a channel before the platform, bridged; or pits flanking the floor). It stays
 * open: pieces that cannot be walked never take more than a third of its floor.
 */

import type { CellDir, CellPoint, DungeonRoom } from '../model';
import { dir } from '../geometry';
import { type Rng, chance, weighted } from '../rng';
import type { DungeonTag } from '../tags';
import { draft } from './catalog';
import { ensureCover, tryShape } from './cover';
import { farWallBlock, platformAtFarWall } from './elevation';
import type { FloorTerrain } from './floorTerrain';
import { placeHazard } from './hazards';
import { RoomCells } from './roomCells';
import type { TerrainWork } from './work';

/** Pieces that cannot be walked take at most this share of the arena's floor. */
const OPEN_SHARE = 1 / 3;

type SetPiece = 'statues' | 'altar' | 'ring' | 'pillars';

function negate(d: CellDir): CellDir {
  return dir(-d.x, -d.y);
}

function roomy(rc: RoomCells, cells: number): boolean {
  return rc.blockedCount() + cells <= rc.floorCount * OPEN_SHARE;
}

/** The objective in the arena's open middle, between the door and the platform. */
function setPiece(floor: FloorTerrain, rc: RoomCells, rng: Rng, choice: SetPiece, platformDepth: number): boolean {
  const room = rc.room.id;
  const facing = negate(rc.axis);
  const open = rc.depth - platformDepth;
  const midI = Math.max(1, Math.floor(open / 2) - 1);
  const midJ = Math.floor((rc.width - 1) / 2);
  switch (choice) {
    case 'statues': {
      // Three statues in a triangle, its point towards the platform.
      const spots = [rc.block(midI + 2, midJ, 1, 1), rc.block(midI, midJ - 2, 1, 1), rc.block(midI, midJ + 2, 1, 1)];
      if (rc.width < 5 || open < 5 || !spots.every((cells) => rc.fits(cells)) || !roomy(rc, 3)) return false;
      if (!rc.allows(spots.flat(), 'block')) return false;
      spots.forEach((cells) => floor.place(draft('statue', room, cells, { facing: dir(cells[0]!.x - rc.cell(midI + 1, midJ).x, cells[0]!.y - rc.cell(midI + 1, midJ).y) })));
      return true;
    }
    case 'altar': {
      const cells = rc.width % 2 === 1 ? rc.block(midI, midJ, 2, 1) : rc.block(midI, midJ, 1, 2);
      return roomy(rc, cells.length) && floor.place(draft('altar', room, cells, { facing })) !== null;
    }
    case 'ring': {
      const size = rc.width >= 10 && open >= 8 ? 3 : 2;
      if (rc.width < size + 4 || open < size + 3) return false;
      const j = Math.floor((rc.width - size) / 2);
      return roomy(rc, size * size) && floor.place(draft('portal-ring', room, rc.block(midI, j, size, size), { facing })) !== null;
    }
    case 'pillars': {
      if (rc.width < 7 || open < 6) return false;
      const corners = [
        [midI - 1, 1],
        [midI - 1, rc.width - 2],
        [midI + 2, 1],
        [midI + 2, rc.width - 2],
      ] as const;
      const cells = corners.map(([i, j]) => rc.block(Math.max(1, i), j, 1, 1));
      if (!roomy(rc, 4) || !cells.every((c) => rc.fits(c)) || !rc.allows(cells.flat(), 'block')) return false;
      cells.forEach((c) => floor.place(draft('pillar', room, c, { facing })));
      return true;
    }
  }
}

/** Wide cover across the arena's middle: two pillars or two wall fragments, mirrored. */
function wideCover(floor: FloorTerrain, rc: RoomCells, rng: Rng, platformDepth: number): void {
  const open = rc.depth - platformDepth;
  const i = Math.max(1, Math.floor(open * 0.35));
  const size = rc.width >= 9 && open >= 7 ? 2 : 1;
  const pillarFirst = chance(rng, 0.6);
  const pillar = { kind: 'pillar' as const, di: size, dj: size };
  const wall = { kind: 'wall-fragment' as const, di: 1, dj: Math.min(3, Math.max(2, Math.floor(rc.width / 4))) };
  for (const shape of pillarFirst ? [pillar, wall] : [wall, pillar]) {
    const left = Math.max(1, Math.floor(rc.width / 5));
    const right = rc.width - left - shape.dj;
    if (right - left < shape.dj + 1 || !roomy(rc, shape.di * shape.dj * 2)) continue;
    if (tryShape(floor, rc, shape, i, left) && tryShape(floor, rc, shape, i, right)) return;
  }
}

/** The arena's platform: rows deep, at most how wide, and how high. */
function arenaPlatform(rc: Pick<RoomCells, 'depth' | 'width'>): { deep: number; widest: number; elevation: number } {
  return { deep: rc.depth >= 8 ? 2 : 1, widest: Math.ceil(rc.width * 0.6), elevation: rc.depth >= 9 ? 2 : 1 };
}

/** The cells the arena's platform takes at its widest, its steps and the cells at their foot: what a cave keeps floor in its boss room. */
export function arenaSeeds(room: DungeonRoom): CellPoint[] {
  const { cells: _mask, ...rect } = room;
  const rc = new RoomCells(rect, [], [], 0, []);
  const { deep, widest } = arenaPlatform(rc);
  const w = Math.min(widest, rc.width - 2);
  if (rc.depth < deep + 3 || w < 3) return [];
  const { cells, foot } = farWallBlock(rc, deep, w);
  return [...cells, ...foot];
}

/** Turns the boss room into an arena. */
export function furnishArena(work: TerrainWork, k: number, rc: RoomCells, rng: Rng, tags: ReadonlySet<DungeonTag>): void {
  const floor = work.floors[k];
  if (!floor) return;
  const { deep, widest, elevation } = arenaPlatform(rc);
  const raised = platformAtFarWall(floor, rc, deep, widest, elevation) !== null;
  const platformDepth = raised ? deep : 0;
  const pieces: (readonly [SetPiece, number])[] = [
    ['statues', 3],
    ['altar', 1.5],
    ['ring', 2],
    ['pillars', 2],
  ];
  const first = weighted(rng, pieces);
  const placed = [first, ...pieces.map(([p]) => p).filter((p) => p !== first)].some((p) => setPiece(floor, rc, rng, p, platformDepth));
  wideCover(floor, rc, rng, platformDepth);
  ensureCover(floor, rc, tags);
  if (chance(rng, placed ? 0.5 : 0.8) && roomy(rc, rc.width)) placeHazard(work, k, rc, rng, chance(rng, 0.6) ? 'channel' : 'pit');
}
