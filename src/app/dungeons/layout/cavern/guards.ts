/**
 * The token-fit guards of a shaped cave floor (report §6.8 step 4), checked and repaired by giving
 * cells back to their rooms: no chamber cell with fewer than two floor cells beside it, no two
 * floor cells meeting only at a corner, a 3 × 3 block in every chamber, and the main path two
 * cells wide from end to end. A crawl (a secret door) is rock as drawn, so no floor here.
 */

import type { PlannedFloor } from '../../floors/planFloors';
import { cellKey, cellsOf, floorRect } from '../../geometry';
import type { CellPoint, DungeonRoom } from '../../model';
import { type CaveGrid, NEAR4, ROCK, doorOwner, unkey } from './caveGrid';

export type GuardKind = 'thin' | 'corner' | 'no-block' | 'lane';

export interface GuardProblem {
  kind: GuardKind;
  at: CellPoint;
  room?: number;
}

/** Whether the cell is floor as the cave is drawn: a room's or a narrows', not a crawl's. */
function floorAt(grid: CaveGrid, floor: PlannedFloor): (x: number, y: number) => boolean {
  const crawls = new Set(floor.doors.flatMap((door, k) => (door.kind === 'secret' ? [doorOwner(k)] : [])));
  return (x, y) => {
    const owner = grid.owner(x, y);
    return owner !== ROCK && !crawls.has(owner);
  };
}

function hasBlock(grid: CaveGrid, room: DungeonRoom): boolean {
  return grid.cellsOf(room.id).some((c) => [0, 1, 2].every((dx) => [0, 1, 2].every((dy) => grid.holds(c.x + dx, c.y + dy, room.id))));
}

/** Whether 2 × 2 blocks of floor lead from a block holding `from` to one holding `to`. */
function wideWay(isFloor: (x: number, y: number) => boolean, from: CellPoint, to: CellPoint): boolean {
  const fits = (ax: number, ay: number): boolean => isFloor(ax, ay) && isFloor(ax + 1, ay) && isFloor(ax, ay + 1) && isFloor(ax + 1, ay + 1);
  const around = (c: CellPoint): string[] => [[c.x - 1, c.y - 1], [c.x, c.y - 1], [c.x - 1, c.y], [c.x, c.y]].filter(([ax, ay]) => fits(ax!, ay!)).map(([ax, ay]) => cellKey(ax!, ay!));
  const goals = new Set(around(to));
  const seen = new Set(around(from));
  const queue = [...seen];
  for (let head = 0; head < queue.length; head++) {
    if (goals.has(queue[head]!)) return true;
    const { x: ax, y: ay } = unkey(queue[head]!);
    for (const [dx, dy] of NEAR4) {
      const k = cellKey(ax + dx, ay + dy);
      if (seen.has(k) || !fits(ax + dx, ay + dy)) continue;
      seen.add(k);
      queue.push(k);
    }
  }
  return false;
}

export function guardProblems(grid: CaveGrid, floor: PlannedFloor, lane: readonly CellPoint[]): GuardProblem[] {
  const isFloor = floorAt(grid, floor);
  const out: GuardProblem[] = [];
  for (const room of floor.rooms) {
    if (room.kind !== 'room') continue;
    for (const c of grid.cellsOf(room.id)) if (NEAR4.filter(([dx, dy]) => isFloor(c.x + dx, c.y + dy)).length < 2) out.push({ kind: 'thin', at: c, room: room.id });
    if (!hasBlock(grid, room)) out.push({ kind: 'no-block', at: { x: room.x, y: room.y }, room: room.id });
  }
  const { x0, y0, w, h } = grid.box();
  for (let y = y0; y < y0 + h - 1; y++) {
    for (let x = x0; x < x0 + w - 1; x++) {
      const a = isFloor(x, y);
      const d = isFloor(x + 1, y + 1);
      if (a === d && isFloor(x + 1, y) === isFloor(x, y + 1) && a !== isFloor(x + 1, y)) out.push({ kind: 'corner', at: { x, y } });
    }
  }
  const first = lane[0];
  const last = lane[lane.length - 1];
  if (!first || !last || !wideWay(isFloor, first, last)) out.push({ kind: 'lane', at: first ?? { x: 0, y: 0 } });
  return out;
}

/** Gives a room a rock cell of its rectangle where it may. */
function giveBack(grid: CaveGrid, room: DungeonRoom, c: CellPoint): boolean {
  if (grid.owner(c.x, c.y) !== ROCK || grid.envelope(c.x, c.y) !== room.id || !grid.mayClaim(c.x, c.y, room.id)) return false;
  grid.claim(c.x, c.y, room.id);
  return true;
}

/** Completes the 3 × 3 block of the room's rectangle that lacks the fewest cells it may take. */
function completeBlock(grid: CaveGrid, room: DungeonRoom): void {
  const r = floorRect(room);
  let best: CellPoint[] | null = null;
  for (let y = r.y0; y + 2 <= r.y1; y++) {
    for (let x = r.x0; x + 2 <= r.x1; x++) {
      const missing = cellsOf({ x0: x, y0: y, x1: x + 2, y1: y + 2 }).filter((c) => !grid.holds(c.x, c.y, room.id));
      if (missing.every((c) => grid.envelope(c.x, c.y) === room.id && grid.mayClaim(c.x, c.y, room.id)) && (!best || missing.length < best.length)) best = missing;
    }
  }
  for (const c of best ?? []) grid.claim(c.x, c.y, room.id);
}

/** Whether the room's cells stay one piece without `c`. */
function wholeWithout(grid: CaveGrid, room: DungeonRoom, c: CellPoint): boolean {
  const cells = grid.cellsOf(room.id).filter((d) => d.x !== c.x || d.y !== c.y);
  if (cells.length === 0) return false;
  const keys = new Set(cells.map((d) => cellKey(d.x, d.y)));
  const seen = new Set([cellKey(cells[0]!.x, cells[0]!.y)]);
  const queue = [cells[0]!];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const [dx, dy] of NEAR4) {
      const k = cellKey(at.x + dx, at.y + dy);
      if (keys.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push({ x: at.x + dx, y: at.y + dy });
      }
    }
  }
  return seen.size === keys.size;
}

/**
 * A spur one cell thin: widened where its room may take a cell beside it that is not left thin in
 * turn (else the next round gives it back and the spur is thin again), else given back to the rock
 * where nothing needs it.
 */
function repairThin(grid: CaveGrid, isFloor: (x: number, y: number) => boolean, room: DungeonRoom, at: CellPoint): void {
  const held = (c: CellPoint): boolean => NEAR4.filter(([dx, dy]) => isFloor(c.x + dx, c.y + dy)).length >= 2;
  if (NEAR4.some(([dx, dy]) => held({ x: at.x + dx, y: at.y + dy }) && giveBack(grid, room, { x: at.x + dx, y: at.y + dy }))) return;
  if (!grid.required(room.id).has(cellKey(at.x, at.y)) && wholeWithout(grid, room, at)) grid.release(at.x, at.y);
}

function repairOne(grid: CaveGrid, floor: PlannedFloor, problem: GuardProblem): void {
  const room = problem.room === undefined ? undefined : floor.rooms[problem.room];
  if (problem.kind === 'no-block' && room) completeBlock(grid, room);
  if (problem.kind === 'thin' && room) repairThin(grid, floorAt(grid, floor), room, problem.at);
  if (problem.kind === 'corner') {
    const { x, y } = problem.at;
    const square = [{ x: x + 1, y }, { x, y: y + 1 }, { x, y }, { x: x + 1, y: y + 1 }];
    const filled = square
      .filter((c) => grid.owner(c.x, c.y) === ROCK)
      .some((c) => {
        const owner = floor.rooms[grid.envelope(c.x, c.y)];
        return owner !== undefined && giveBack(grid, owner, c);
      });
    if (!filled) square.some((c) => releaseSwung(grid, floor, c));
  }
}

/**
 * Gives a cell back to the rock where a room took it past its own rectangle (a chamber's swell, a
 * tunnel's swing), nothing needs it and nothing is parted: what a pinch leaves when no gap beside
 * it can be filled.
 */
function releaseSwung(grid: CaveGrid, floor: PlannedFloor, c: CellPoint): boolean {
  const room = floor.rooms[grid.owner(c.x, c.y)];
  if (!room || grid.envelope(c.x, c.y) === room.id || grid.required(room.id).has(cellKey(c.x, c.y))) return false;
  // A cell with at most one floor cell beside it parts nothing; a tunnel's own cells meet only through its narrows.
  const isFloor = floorAt(grid, floor);
  if (NEAR4.filter(([dx, dy]) => isFloor(c.x + dx, c.y + dy)).length > 1 && !wholeWithout(grid, room, c)) return false;
  grid.release(c.x, c.y);
  return true;
}

/** Repairs what it can, the cells nearest each problem first, and checks again; the problems left. */
export function repairGuards(grid: CaveGrid, floor: PlannedFloor, lane: readonly CellPoint[]): GuardProblem[] {
  let problems = guardProblems(grid, floor, lane);
  for (let round = 0; round < 6 && problems.length > 0; round++) {
    for (const problem of problems) repairOne(grid, floor, problem);
    problems = guardProblems(grid, floor, lane);
  }
  return problems;
}
