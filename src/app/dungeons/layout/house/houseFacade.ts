/**
 * A house's facades (report 2026-10-25-mansion-windows-research): the lines of its ground floor's
 * outer walls, each divided into bays, the cells where a window may stand, one every `period`
 * cells. The same bays serve every floor, so windows stand over windows. A front that crosses the
 * axis of a symmetric house, or holds an entrance, counts its bays from the door outwards, so they
 * mirror about it and one stands over the door; any other line has its bays about its own middle,
 * and in a symmetric house the lines east of the axis take the mirror of their twin's.
 */

import type { CellDir, DungeonDoor } from '../../model';
import { doorCells } from '../../geometry';
import { type Rng, chance } from '../../rng';
import { SIDES } from './houseEdges';

/** Which cells along a wall carry a window: every `period`th on the side and back walls. `phase` is kept for the random stream and unused. */
export interface FacadeGrid {
  period: number;
  phase: number;
}

/** A house's facade grid: a window every second or third cell. */
export function facadeGrid(rng: Rng): FacadeGrid {
  return { period: chance(rng, 0.5) ? 2 : 3, phase: rng() < 0.5 ? 0 : 1 };
}

/** The edges of a floor's entrances, from the cell inside, the way out. */
export function entranceEdges(doors: readonly DungeonDoor[]): Edge[][] {
  return doors.filter((d) => d.from === null).map((d) => doorCells(d).map((c) => ({ x: c.x + d.dir.x, y: c.y + d.dir.y, dir: { x: (0 - d.dir.x) as CellDir['x'], y: (0 - d.dir.y) as CellDir['y'] } })));
}

/** An edge of a cell: the cell, and the way out of it. */
export interface Edge {
  x: number;
  y: number;
  dir: CellDir;
}

interface FacadeLine {
  dir: CellDir;
  /** The line's place across the wall (`y` of a horizontal wall, `x` of a vertical one), and its first and last cell along it. */
  at: number;
  from: number;
  to: number;
  bay: (u: number) => boolean;
}

export interface Facade {
  /** Whether a window on `edge` stands in a bay of the facade it faces. */
  isBay(edge: Edge): boolean;
  /** Whether `edge` lies on a line whose bays mirror about the axis of a symmetric house. */
  onAxis(edge: Edge): boolean;
  /** Whether `edge` stands over (or on) an entrance of the ground floor, whatever the row of its floor's wall. */
  overEntrance(edge: Edge): boolean;
}

/** A front that holds an entrance or mirrors about the axis has a bay every two cells, a window to a pier, as a Georgian front has. */
const FRONT_PERIOD = 2;

export const acrossOf = (e: Edge): number => (e.dir.y !== 0 ? e.y : e.x);
export const alongEdge = (e: Edge): number => (e.dir.y !== 0 ? e.x : e.y);

/**
 * Bays every `period` cells counted outwards from a door or axis whose cells' doubled middle is
 * `centre2`. An axis between two cells has a bay on either side of it only where an entrance stands
 * there (`entrance`), a pair over a double door: anywhere else two windows would touch.
 */
function fromCentre(centre2: number, period: number, entrance: (u: number) => boolean): (u: number) => boolean {
  const odd = ((centre2 % 2) + 2) % 2;
  return (u) => {
    const d = Math.abs(2 * u - centre2);
    return (d - odd) % (2 * period) === 0 && (d !== 1 || entrance(u));
  };
}

/** Bays every `period` cells between a line's corner cells, as near its middle as whole cells allow. */
function fromMiddle(from: number, to: number, period: number): (u: number) => boolean {
  const inner = to - from - 1;
  const first = from + 1 + Math.floor(((inner - 1) % period) / 2);
  return (u) => inner > 0 && u >= first && u < to && (u - first) % period === 0;
}

export interface FacadeInput {
  frame: { width: number; symmetric: boolean };
  /** Whether a cell lies inside the house on its ground floor. */
  inHouse: (x: number, y: number) => boolean;
  /** Every cell of the ground floor's rooms. */
  cells: readonly { x: number; y: number }[];
  /** The ground floor's entrances: their inside cells and the way out. */
  entrances: readonly Edge[][];
  grid: FacadeGrid;
}

export function houseFacade(input: FacadeInput): Facade {
  const { frame, inHouse, grid } = input;
  const p = grid.period;
  const axis2 = frame.width - 1;
  const lines: FacadeLine[] = [];
  for (const dir of SIDES) {
    const byLine = new Map<number, number[]>();
    for (const c of input.cells) {
      if (inHouse(c.x + dir.x, c.y + dir.y)) continue;
      const e = { ...c, dir };
      const list = byLine.get(acrossOf(e)) ?? [];
      list.push(alongEdge(e));
      byLine.set(acrossOf(e), list);
    }
    for (const [at, us] of byLine) {
      const sorted = [...new Set(us)].sort((a, b) => a - b);
      let from = sorted[0]!;
      for (let k = 1; k <= sorted.length; k++) {
        if (k < sorted.length && sorted[k] === sorted[k - 1]! + 1) continue;
        lines.push({ dir, at, from, to: sorted[k - 1]!, bay: () => false });
        from = sorted[k]!;
      }
    }
  }
  for (const line of lines) line.bay = baysOf(line, input, axis2, p);
  const lineOf = (e: Edge): FacadeLine | undefined => {
    const u = alongEdge(e);
    let best: FacadeLine | undefined;
    for (const l of lines) if (l.dir.x === e.dir.x && l.dir.y === e.dir.y && u >= l.from && u <= l.to && (!best || Math.abs(l.at - acrossOf(e)) < Math.abs(best.at - acrossOf(e)))) best = l;
    return best;
  };
  return {
    isBay: (e) => lineOf(e)?.bay(alongEdge(e)) ?? false,
    overEntrance: (e) => input.entrances.some((cells) => cells.some((c) => c.dir.x === e.dir.x && c.dir.y === e.dir.y && alongEdge(c) === alongEdge(e))),
    onAxis: (e) => {
      const l = lineOf(e);
      return !!l && frame.symmetric && l.dir.y !== 0 && 2 * l.from <= axis2 && 2 * l.to >= axis2;
    },
  };
}

function baysOf(line: FacadeLine, input: FacadeInput, axis2: number, p: number): (u: number) => boolean {
  const horizontal = line.dir.y !== 0;
  if (horizontal && input.frame.symmetric) {
    if (2 * line.from <= axis2 && 2 * line.to >= axis2) return fromCentre(axis2, FRONT_PERIOD, (u) => doorAt(line, input, u));
    // East of the axis a line takes its western twin's bays, mirrored.
    if (2 * line.from > axis2) {
      const twin = fromMiddle(axis2 - line.to, axis2 - line.from, p);
      return (u) => twin(axis2 - u);
    }
    return fromMiddle(line.from, line.to, p);
  }
  const door = input.entrances.find((cells) => cells.every((c) => c.dir.x === line.dir.x && c.dir.y === line.dir.y && acrossOf(c) === line.at && alongEdge(c) >= line.from && alongEdge(c) <= line.to));
  if (door) return fromCentre(alongEdge(door[0]!) + alongEdge(door[door.length - 1]!), FRONT_PERIOD, (u) => doorAt(line, input, u));
  return fromMiddle(line.from, line.to, p);
}

/** Whether an entrance of the ground floor stands on `line` at `u`. */
function doorAt(line: FacadeLine, input: FacadeInput, u: number): boolean {
  return input.entrances.some((cells) => cells.some((c) => c.dir.x === line.dir.x && c.dir.y === line.dir.y && acrossOf(c) === line.at && alongEdge(c) === u));
}
