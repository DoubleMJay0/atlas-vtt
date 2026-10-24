import { describe, expect, it } from 'vitest';
import { planFloors } from '../../../../src/app/dungeons/floors/planFloors';
import { cellKey, floorRect, inRect } from '../../../../src/app/dungeons/geometry';
import { CaveGrid } from '../../../../src/app/dungeons/layout/cavern/caveGrid';
import { caveParams } from '../../../../src/app/dungeons/layout/cavern/caveParams';
import { chamberSeeds, growChamber, smoothChamber } from '../../../../src/app/dungeons/layout/cavern/chambers';
import { faultDirections, nearFault } from '../../../../src/app/dungeons/layout/cavern/faults';
import { claimLane, laneEnds, mainRoute, wideLane } from '../../../../src/app/dungeons/layout/cavern/mainPath';
import type { CellPoint, DungeonRoom } from '../../../../src/app/dungeons/model';
import { dungeonParams, dungeonTags } from '../../../../src/app/dungeons/params';
import { rngFrom, stream } from '../../../../src/app/dungeons/rng';
import { arenaSeeds } from '../../../../src/app/dungeons/terrain/arena';

const SETS: string[][] = [[], ['large'], ['lava'], ['deep'], ['small'], ['spacious', 'wet']];

interface Shaped {
  room: DungeonRoom;
  seeds: CellPoint[];
  grown: number;
  mask: CellPoint[];
  fill: readonly [number, number];
  target: number;
  faults: readonly number[];
}

function shapedChambers(): Shaped[] {
  const out: Shaped[] = [];
  let floors = 0;
  for (let k = 1; floors < 400; k++) {
    const seed = k * 4_391;
    const params = caveParams(dungeonParams(dungeonTags(seed, SETS[k % SETS.length]!)));
    const shaping = params.cave!;
    const planned = planFloors(seed, params, 1 + (k % 2), true);
    const faults = faultDirections(stream(seed, 'cave', 'faults'), planned[0]!.rooms);
    planned.forEach((floor, index) => {
      floors++;
      const grid = new CaveGrid(floor, index);
      const [from, to] = laneEnds(index, planned.length, floor, true);
      const route = mainRoute(floor, from, to);
      const lane = wideLane(grid, floor, route, from, to) ?? [];
      claimLane(grid, floor, route, lane);
      const laneKeys = new Set(lane.map((c) => cellKey(c.x, c.y)));
      floor.rooms
        .filter((room) => room.kind === 'room')
        .forEach((room, n) => {
          const seeds = chamberSeeds(grid, room, laneKeys);
          const rng = rngFrom(seed + room.id);
          const fill = shaping.fill[0] + rng() * (shaping.fill[1] - shaping.fill[0]);
          const gamma = shaping.gamma[0] + rng() * (shaping.gamma[1] - shaping.gamma[0]);
          growChamber(rng, grid, room, seeds, { gamma, stretch: shaping.stretch, fill, faults });
          const grown = grid.cellsOf(room.id).length;
          smoothChamber(grid, room, new Set(seeds.map((c) => cellKey(c.x, c.y))), n % 2 === 0 ? 2 : 1);
          const target = Math.min(room.w * room.h, Math.max(Math.round(fill * room.w * room.h), seeds.length + 9));
          out.push({ room, seeds, grown, mask: grid.cellsOf(room.id), fill: shaping.fill, target, faults });
        });
    });
  }
  return out;
}

function connected(cells: readonly CellPoint[]): boolean {
  const keys = new Set(cells.map((c) => cellKey(c.x, c.y)));
  const seen = new Set([cellKey(cells[0]!.x, cells[0]!.y)]);
  const queue = [cells[0]!];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = cellKey(c.x + dx, c.y + dy);
      if (keys.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push({ x: c.x + dx, y: c.y + dy });
      }
    }
  }
  return seen.size === keys.size;
}

function hasBlock(cells: readonly CellPoint[]): boolean {
  const keys = new Set(cells.map((c) => cellKey(c.x, c.y)));
  return cells.some((c) => [0, 1, 2].every((dx) => [0, 1, 2].every((dy) => keys.has(cellKey(c.x + dx, c.y + dy)))));
}

/** The long axis of the cells' spread, and how much longer it is than the short one. */
function principal(cells: readonly CellPoint[]): { angle: number; ratio: number } {
  const mx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
  const my = cells.reduce((s, c) => s + c.y, 0) / cells.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const c of cells) {
    sxx += (c.x - mx) ** 2;
    syy += (c.y - my) ** 2;
    sxy += (c.x - mx) * (c.y - my);
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const t = (sxx + syy) / 2;
  const d = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2);
  return { angle, ratio: Math.sqrt((t + d) / Math.max(1e-9, t - d)) };
}

describe('cave chambers', () => {
  const chambers = shapedChambers();

  it('keep their seeds, stay one piece and stay inside their rectangle', () => {
    for (const { room, seeds, mask } of chambers) {
      const keys = new Set(mask.map((c) => cellKey(c.x, c.y)));
      for (const c of seeds) expect(keys.has(cellKey(c.x, c.y))).toBe(true);
      expect(connected(mask)).toBe(true);
      for (const c of mask) expect(inRect(floorRect(room), c.x, c.y)).toBe(true);
    }
  });

  it('grow to their fill, or to their seeds and nine more', () => {
    for (const { room, grown, target, fill, seeds } of chambers) {
      expect(grown).toBeLessThanOrEqual(target);
      const share = grown / (room.w * room.h);
      const area = room.w * room.h;
      if (target > seeds.length + 9) expect(share).toBeGreaterThanOrEqual(fill[0] - 0.5 / area - 1e-9);
      if (target > seeds.length + 9) expect(share).toBeLessThanOrEqual(fill[1] + 0.5 / area + 1e-9);
    }
  });

  it('hold a 3 × 3 block of their own cells', () => {
    for (const { mask } of chambers) expect(hasBlock(mask)).toBe(true);
  });

  it('stretch along a fault', () => {
    const long = chambers.map((c) => ({ ...principal(c.mask), faults: c.faults })).filter((p) => p.ratio >= 1.2);
    const along = long.filter((p) => nearFault(p.angle, p.faults, Math.PI / 6));
    expect(along.length / long.length).toBeGreaterThanOrEqual(0.6);
  });

  it('keep the boss arena’s platform', () => {
    const bosses = chambers.filter((c) => c.room.boss);
    expect(bosses.length).toBeGreaterThan(50);
    for (const { room, mask } of bosses) {
      const keys = new Set(mask.map((c) => cellKey(c.x, c.y)));
      for (const c of arenaSeeds(room)) expect(keys.has(cellKey(c.x, c.y))).toBe(true);
    }
  });
});
