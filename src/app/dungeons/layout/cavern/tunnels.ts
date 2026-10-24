/**
 * A cave's tunnels: each corridor and junction becomes a passage that winds between its openings
 * (Boris the Brave's chiselled paths): every cell it may take, its rectangle and the walls round
 * it, is taken away in a seeded order, the cells near the straight way first, unless that would cut
 * the openings apart. The main path's tunnels keep their lane, two cells wide; a side passage is
 * one or two wide. Every door becomes a narrows; one the lane passes is two cells wide.
 */

import { doorApproaches } from '../../floors/stairSpots';
import { cellKey, cellsOf, dir, floorRect, inRect, wallRect } from '../../geometry';
import type { CellPoint, DungeonDoor, DungeonRoom } from '../../model';
import type { Rng } from '../../rng';
import { type CaveGrid, ROCK, doorOwner } from './caveGrid';

/** How strongly the cells near the straight way go first, so what is left winds. */
const WIGGLE = 1.5;

const NEAR4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const key = (c: CellPoint): string => cellKey(c.x, c.y);
const unkey = (k: string): CellPoint => {
  const [x, y] = k.split(',').map(Number) as [number, number];
  return { x, y };
};

/** The cells inside a tunnel's doors: where its way must reach. */
export function tunnelEnds(grid: CaveGrid, room: DungeonRoom, doors: readonly DungeonDoor[]): CellPoint[] {
  const rect = floorRect(room);
  return doorApproaches(room, doors).filter((c) => inRect(rect, c.x, c.y) && (grid.owner(c.x, c.y) === ROCK || grid.holds(c.x, c.y, room.id)));
}

/** The cells on ways through `alive` from the first kept cell to every other, or null where one cannot be reached. */
function witness(alive: ReadonlySet<string>, keep: readonly string[]): Set<string> | null {
  const [first] = keep;
  if (first === undefined) return new Set();
  const back = new Map<string, string>([[first, first]]);
  const queue = [first];
  for (let head = 0; head < queue.length; head++) {
    const c = unkey(queue[head]!);
    for (const [dx, dy] of NEAR4) {
      const k = cellKey(c.x + dx, c.y + dy);
      if (!alive.has(k) || back.has(k)) continue;
      back.set(k, queue[head]!);
      queue.push(k);
    }
  }
  const out = new Set<string>();
  for (const k of keep) {
    if (!back.has(k)) return null;
    for (let at = k; !out.has(at); at = back.get(at)!) {
      out.add(at);
      if (at === first) break;
    }
  }
  return out;
}

/** How near the cell lies to the straight ways between the ends: 1 on them, 0 two cells off. */
function nearness(c: CellPoint, ends: readonly CellPoint[]): number {
  let best = Infinity;
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i]!;
      const b = ends[j]!;
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((c.x - a.x) * ex + (c.y - a.y) * ey) / (ex * ex + ey * ey || 1)));
      best = Math.min(best, Math.hypot(c.x - a.x - ex * t, c.y - a.y - ey * t));
    }
  }
  return Number.isFinite(best) ? Math.max(0, 1 - best / 2) : 0;
}

/** Grows a one-cell way to two where the cells allow: each cell joins a 2 × 2 block of the way. */
function widen(alive: Set<string>, may: ReadonlySet<string>): void {
  const inBlock = (ax: number, ay: number): boolean => [0, 1].every((dx) => [0, 1].every((dy) => alive.has(cellKey(ax + dx, ay + dy))));
  for (const k of [...alive].sort()) {
    const c = unkey(k);
    const anchors = [[c.x - 1, c.y - 1], [c.x, c.y - 1], [c.x - 1, c.y], [c.x, c.y]] as const;
    if (anchors.some(([ax, ay]) => inBlock(ax, ay))) continue;
    const fits = anchors.find(([ax, ay]) => [0, 1].every((dx) => [0, 1].every((dy) => may.has(cellKey(ax + dx, ay + dy)))));
    if (fits) for (const dx of [0, 1]) for (const dy of [0, 1]) alive.add(cellKey(fits[0] + dx, fits[1] + dy));
  }
}

/**
 * Carves the tunnel of `room` (a corridor or junction) between `ends`, within its rectangle and
 * the walls round it, keeping the lane cells it holds and widening to `width`.
 */
export function carveTunnel(rng: Rng, grid: CaveGrid, room: DungeonRoom, ends: readonly CellPoint[], width: 1 | 2, lane: ReadonlySet<string>): void {
  const rect = floorRect(room);
  const may = new Set(
    cellsOf(wallRect(room))
      .filter((c) => grid.holds(c.x, c.y, room.id) || (inRect(rect, c.x, c.y) ? grid.mayClaim(c.x, c.y, room.id) : grid.mayWiden(c.x, c.y, room.id)))
      .map(key),
  );
  const keep = [...new Set([...ends.map(key), ...grid.required(room.id), ...[...lane].filter((k) => may.has(k))])].filter((k) => may.has(k));
  const kept = new Set(keep);
  const alive = new Set(may);
  let way = witness(alive, keep);
  if (way) {
    const order = [...may]
      .filter((k) => !kept.has(k))
      .map((k) => [k, rng() + WIGGLE * nearness(unkey(k), ends)] as const)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    for (const [k] of order) {
      alive.delete(k);
      if (!way.has(k)) continue;
      const next = witness(alive, keep);
      if (next) way = next;
      else alive.add(k);
    }
  }
  if (width === 2) widen(alive, may);
  for (const c of cellsOf(wallRect(room))) {
    const k = key(c);
    if (alive.has(k)) grid.claim(c.x, c.y, room.id);
    else if (grid.holds(c.x, c.y, room.id)) grid.release(c.x, c.y);
  }
}

/**
 * The doors as a cave has them: every door a narrows (an opening), two cells wide where the lane
 * passes it and the wall cell beside it (and the grid, where given, gave that cell to this door);
 * secret doors stay crawls and steps a scree slope.
 */
export function shapeDoors(doors: readonly DungeonDoor[], lane: ReadonlySet<string>, grid?: Pick<CaveGrid, 'owner'>): DungeonDoor[] {
  return doors.map((door, k) => {
    const kind = door.kind === 'door' ? 'opening' : door.kind;
    const along = [dir(door.dir.y, door.dir.x), dir(-door.dir.y, -door.dir.x)];
    const ours = (x: number, y: number): boolean => lane.has(cellKey(x, y)) && (!grid || grid.owner(x, y) === doorOwner(k));
    const wide = ours(door.x, door.y) ? along.find((d) => ours(door.x + d.x, door.y + d.y)) : undefined;
    return { ...door, kind, ...(wide && kind !== 'secret' && { wide }) };
  });
}
