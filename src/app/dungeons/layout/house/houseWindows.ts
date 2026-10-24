/**
 * A house's windows (research §5.7): on every outer wall, on a facade grid that is the same on every
 * floor (so windows stand over windows) and mirrors about the axis where the style does, one to every
 * two or three cells, at least one in every room with an outer wall, never where a door stands. A
 * cellar has none.
 */

import { cellKey, holdsCell, houseCells } from '../../geometry';
import type { PlannedFloor } from '../../floors/planFloors';
import type { CellDir, DungeonDoor, DungeonWindow } from '../../model';
import { doorCells } from '../../geometry';
import { type Rng, chance } from '../../rng';
import { SIDES, runsOf } from './houseEdges';
import type { HouseFrame } from './houseFrame';
import type { TypedRoom } from './houseZones';

/** Which cells along a wall carry a window: every `period`th from `phase`, mirrored about the house's middle where it is symmetric. */
export interface FacadeGrid {
  period: number;
  phase: number;
}

/** A house's facade grid: a window every second or third cell. */
export function facadeGrid(rng: Rng): FacadeGrid {
  return { period: chance(rng, 0.5) ? 2 : 3, phase: rng() < 0.5 ? 0 : 1 };
}

function onGrid(grid: FacadeGrid, frame: Pick<HouseFrame, 'width' | 'symmetric'>, at: number, horizontal: boolean): boolean {
  const hit = (u: number): boolean => (((u - grid.phase) % grid.period) + grid.period) % grid.period === 0;
  if (!horizontal || !frame.symmetric) return hit(at);
  // The facade mirrors about the axis: a cell east of the middle takes its mirror's window.
  const mirror = frame.width - 1 - at;
  return at * 2 < frame.width ? hit(at) : hit(mirror);
}

/** The edge a window stands on, as a key. */
export const windowKey = (w: Pick<DungeonWindow, 'x' | 'y' | 'dir'>): string => `${cellKey(w.x, w.y)}>${w.dir.x},${w.dir.y}`;

/** The edges doors stand on, as `x,y>dx,dy` of the cell inside and the way out. */
function doorEdges(doors: readonly DungeonDoor[]): Set<string> {
  const keys = new Set<string>();
  for (const door of doors) {
    for (const c of doorCells(door)) {
      keys.add(windowKey({ ...c, dir: door.dir }));
      keys.add(windowKey({ x: c.x + door.dir.x, y: c.y + door.dir.y, dir: { x: (0 - door.dir.x) as CellDir['x'], y: (0 - door.dir.y) as CellDir['y'] } }));
    }
  }
  return keys;
}


/** `below`: the windows of the floor underneath, which a room the grid misses stands its window over. */
export function houseWindows(frame: Pick<HouseFrame, 'width' | 'symmetric'>, rooms: readonly TypedRoom[], doors: readonly DungeonDoor[], inHouse: (x: number, y: number) => boolean, grid: FacadeGrid, below: ReadonlySet<string>): DungeonWindow[] {
  const taken = doorEdges(doors);
  const windows: DungeonWindow[] = [];
  rooms.forEach((room, id) => {
    const runs = SIDES.flatMap((side) => runsOf(room, side, (x, y) => !inHouse(x, y)));
    const free = runs.flatMap((run) => run.cells.map((c) => ({ c, dir: run.dir }))).filter(({ c, dir }) => !taken.has(windowKey({ ...c, dir })));
    const placed = free.filter(({ c, dir }) => onGrid(grid, frame, dir.y !== 0 ? c.x : c.y, dir.y !== 0));
    // A room the grid misses still has a window: over one below where it can, else in the middle of its outer walls.
    const over = free.filter(({ c, dir }) => below.has(windowKey({ ...c, dir })));
    const chosen = placed.length > 0 ? placed : over.length > 0 ? over.slice(0, 1) : free.slice(Math.floor(free.length / 2), Math.floor(free.length / 2) + 1);
    for (const { c, dir } of chosen) windows.push({ x: c.x, y: c.y, dir, room: id });
  });
  return windows;
}

/**
 * The window a floor below takes under `window`, so windows stand over windows: where the same edge
 * is an outer wall of one of its rooms there, with no door on it; null where it is not.
 */
export function windowUnder(window: DungeonWindow, floor: PlannedFloor): DungeonWindow | null {
  const holder = floor.rooms.find((r) => holdsCell(r, window.x, window.y));
  const across = { x: window.x + window.dir.x, y: window.y + window.dir.y };
  if (!holder || houseCells({ rooms: floor.rooms, stacks: floor.house?.stacks }).has(cellKey(across.x, across.y)) || doorEdges(floor.doors).has(windowKey(window))) return null;
  return { ...window, room: holder.id };
}
