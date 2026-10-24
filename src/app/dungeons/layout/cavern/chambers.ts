/**
 * A cave chamber grown cell by cell inside its room's rectangle (Watabou's seed growth on square
 * cells): from what the room must keep (a 3 × 3 core near its middle, the cells before its doors,
 * its stairwells and their rows, the lane, the boss arena's platform), each step taking a cell
 * beside the chamber, likelier the more of its eight neighbours are already chamber (`pow(c,
 * gamma)`) and along the cave's faults; then smoothed, never giving up what it must keep.
 */

import { cellKey, cellsOf, floorRect, inRect } from '../../geometry';
import type { CellPoint, DungeonRoom } from '../../model';
import type { Rng } from '../../rng';
import { arenaSeeds } from '../../terrain/arena';
import type { CaveGrid } from './caveGrid';

export interface ChamberShape {
  gamma: number;
  stretch: number;
  fill: number;
  faults: readonly number[];
}

const NEAR4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const NEAR8: readonly (readonly [number, number])[] = [...NEAR4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** A chamber never fills less than its seeds and this many cells more. */
const FLOOR_EXTRA = 9;

const key = (c: CellPoint): string => cellKey(c.x, c.y);
const unkey = (k: string): CellPoint => {
  const [x, y] = k.split(',').map(Number) as [number, number];
  return { x, y };
};

function mayTake(grid: CaveGrid, room: DungeonRoom, c: CellPoint): boolean {
  return inRect(floorRect(room), c.x, c.y) && (grid.holds(c.x, c.y, room.id) || grid.mayClaim(c.x, c.y, room.id));
}

/** The 3 × 3 block nearest the room's middle that the room may take whole; none where nothing of that size fits. */
export function coreBlock(grid: CaveGrid, room: DungeonRoom): CellPoint[] {
  const r = floorRect(room);
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  let best: CellPoint[] = [];
  let bestDistance = Infinity;
  for (let y = r.y0; y + 2 <= r.y1; y++) {
    for (let x = r.x0; x + 2 <= r.x1; x++) {
      const block = cellsOf({ x0: x, y0: y, x1: x + 2, y1: y + 2 });
      const d = Math.hypot(x + 1.5 - cx, y + 1.5 - cy);
      if (d < bestDistance && block.every((c) => mayTake(grid, room, c))) {
        best = block;
        bestDistance = d;
      }
    }
  }
  return best;
}

/**
 * Keeps a 3 × 3 block in every chamber before anything else is shaped, so no tunnel or narrows
 * takes the cells it needs; whether every chamber has one.
 */
export function reserveCores(grid: CaveGrid, rooms: readonly DungeonRoom[]): boolean {
  return rooms.every((room) => {
    if (room.kind !== 'room') return true;
    const core = coreBlock(grid, room);
    grid.require(room.id, core);
    return core.length > 0;
  });
}

/** The fewest cells the room may take that join `cells` to `reached`, or none where no way leads. */
function joinPath(grid: CaveGrid, room: DungeonRoom, from: CellPoint, reached: ReadonlySet<string>): CellPoint[] {
  const back = new Map<string, string>([[key(from), key(from)]]);
  const queue = [key(from)];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    if (reached.has(at)) {
      const path: CellPoint[] = [];
      for (let k = at; k !== key(from); k = back.get(k)!) path.push(unkey(k));
      return path;
    }
    const c = unkey(at);
    for (const [dx, dy] of NEAR4) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (back.has(key(n)) || !mayTake(grid, room, n)) continue;
      back.set(key(n), at);
      queue.push(key(n));
    }
  }
  return [];
}

/** Groups of cells side by side. */
function pieces(cells: ReadonlySet<string>): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of cells) {
    if (seen.has(start)) continue;
    const piece = [start];
    seen.add(start);
    for (let head = 0; head < piece.length; head++) {
      const c = unkey(piece[head]!);
      for (const [dx, dy] of NEAR4) {
        const k = cellKey(c.x + dx, c.y + dy);
        if (cells.has(k) && !seen.has(k)) {
          seen.add(k);
          piece.push(k);
        }
      }
    }
    out.push(piece);
  }
  return out;
}

/** What a chamber must keep, joined into one piece: its core, its kept cells, the lane in it and, for the boss, the arena's platform. */
export function chamberSeeds(grid: CaveGrid, room: DungeonRoom, lane: ReadonlySet<string>): CellPoint[] {
  const r = floorRect(room);
  const seeds = new Set<string>([...coreBlock(grid, room).map(key), ...grid.required(room.id)]);
  for (const k of lane) if (inRect(r, unkey(k).x, unkey(k).y)) seeds.add(k);
  if (room.boss) for (const c of arenaSeeds(room)) if (mayTake(grid, room, c)) seeds.add(key(c));
  const [main, ...rest] = pieces(seeds).sort((a, b) => b.length - a.length);
  const joined = new Set(main ?? []);
  for (const piece of rest) {
    for (const k of piece) joined.add(k);
    for (const c of joinPath(grid, room, unkey(piece[0]!), new Set([...joined].filter((k) => !piece.includes(k))))) joined.add(key(c));
  }
  return [...joined].map(unkey).sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Angle between a direction and the nearer fault, as cos². */
function alongFault(angle: number, faults: readonly number[]): number {
  return faults.reduce((best, fault) => Math.max(best, Math.cos(angle - fault) ** 2), 0);
}

/** Grows the chamber from its seeds to its fill share of the rectangle (never below seeds + 9). */
export function growChamber(rng: Rng, grid: CaveGrid, room: DungeonRoom, seeds: readonly CellPoint[], shape: ChamberShape): void {
  for (const c of seeds) grid.claim(c.x, c.y, room.id);
  const mask = new Set(grid.cellsOf(room.id).filter((c) => inRect(floorRect(room), c.x, c.y)).map(key));
  const target = Math.min(room.w * room.h, Math.max(Math.round(shape.fill * room.w * room.h), seeds.length + FLOOR_EXTRA));
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  while (mask.size < target) {
    const options: [CellPoint, number][] = [];
    const seen = new Set<string>();
    for (const k of mask) {
      const c = unkey(k);
      for (const [dx, dy] of NEAR4) {
        const n = { x: c.x + dx, y: c.y + dy };
        const nk = key(n);
        if (mask.has(nk) || seen.has(nk) || !mayTake(grid, room, n)) continue;
        seen.add(nk);
        const around = NEAR8.filter(([ax, ay]) => mask.has(cellKey(n.x + ax, n.y + ay))).length;
        const angle = Math.atan2(n.y + 0.5 - cy, n.x + 0.5 - cx);
        options.push([n, around ** shape.gamma * shape.stretch ** alongFault(angle, shape.faults)]);
      }
    }
    if (options.length === 0) break;
    options.sort(([a], [b]) => a.y - b.y || a.x - b.x);
    const total = options.reduce((sum, [, w]) => sum + w, 0);
    let pickAt = rng() * total;
    const chosen = options.find(([, w]) => (pickAt -= w) < 0)?.[0] ?? options[options.length - 1]![0];
    grid.claim(chosen.x, chosen.y, room.id);
    mask.add(key(chosen));
  }
}

/** Whether the mask stays one piece without `without`. */
function stillWhole(mask: ReadonlySet<string>, without: string): boolean {
  const rest = new Set(mask);
  rest.delete(without);
  return pieces(rest).length <= 1;
}

/** Fills cells with five or more of their eight neighbours in the chamber and drops those with two or fewer, never a kept one, never splitting it. */
export function smoothChamber(grid: CaveGrid, room: DungeonRoom, keep: ReadonlySet<string>, passes: 1 | 2): void {
  const r = floorRect(room);
  for (let pass = 0; pass < passes; pass++) {
    const mask = new Set(grid.cellsOf(room.id).filter((c) => inRect(r, c.x, c.y)).map(key));
    const count = (c: CellPoint): number => NEAR8.filter(([dx, dy]) => mask.has(cellKey(c.x + dx, c.y + dy))).length;
    for (const c of cellsOf(r)) {
      const k = key(c);
      const n = count(c);
      if (!mask.has(k) && n >= 5 && grid.mayClaim(c.x, c.y, room.id)) {
        grid.claim(c.x, c.y, room.id);
        mask.add(k);
      } else if (mask.has(k) && n <= 2 && !keep.has(k) && stillWhole(mask, k)) {
        grid.release(c.x, c.y);
        mask.delete(k);
      }
    }
  }
}
