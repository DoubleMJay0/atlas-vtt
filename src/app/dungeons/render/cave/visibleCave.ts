/**
 * A Cavern floor as the view shows it: the traced, smoothed outline of the shown rooms' cells and
 * the cells of every shown narrows. A crawl (a secret door) is rock in the drawing; its two mouths
 * stay straight on its cell's edges, as an entrance's outer mouth does, so the walls the scene
 * puts round the crawl meet the cave's exactly. A scree slope's sides and a stairwell's edges
 * stay straight too: their treads are drawn across their whole cells.
 */

import { spotRect } from '../../floors/stairSpots';
import { cellKey, cellsOf, doorCells, floorCellsOf } from '../../geometry';
import type { CellDir, CellPoint, DungeonDoor, DungeonModel, DungeonRoom, DungeonStair } from '../../model';
import { gridOver } from '../../water/wetGrid';
import type { FloorShape } from '../geometry';
import { caveOutline, type PinnedEdge } from './caveOutline';

const memo = new WeakMap<object, Map<string, FloorShape[]>>();

/** The edge of cell `c` on the side `side` points to. */
function edgeOn(c: CellPoint, side: CellDir): PinnedEdge {
  if (side.y !== 0) {
    const y = side.y > 0 ? c.y + 1 : c.y;
    return { a: { x: c.x, y }, b: { x: c.x + 1, y } };
  }
  const x = side.x > 0 ? c.x + 1 : c.x;
  return { a: { x, y: c.y }, b: { x, y: c.y + 1 } };
}

/** The edges that stay straight: an entrance's outer mouth, both mouths of a crawl, and the sides of a scree slope, whose treads span its cell. */
function pinnedEdges(doors: readonly DungeonDoor[]): PinnedEdge[] {
  const back = (d: DungeonDoor): CellDir => ({ x: -d.dir.x as CellDir['x'], y: -d.dir.y as CellDir['y'] });
  const sides = (d: DungeonDoor): CellDir[] => [{ x: d.dir.y, y: d.dir.x }, { x: -d.dir.y as CellDir['x'], y: -d.dir.x as CellDir['y'] }];
  return doors.flatMap((door) => {
    const cells = doorCells(door);
    if (door.kind === 'secret') return cells.flatMap((c) => [edgeOn(c, back(door)), edgeOn(c, door.dir)]);
    const ends = door.from === null ? cells.map((c) => edgeOn(c, back(door))) : [];
    return door.kind === 'steps' ? [...ends, ...cells.flatMap((c) => sides(door).map((side) => edgeOn(c, side)))] : ends;
  });
}

const SIDES: readonly CellDir[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Every edge of a stairwell's cells: where its well meets the rock, the outline keeps to it, so its walls stand where it is drawn. */
function stairEdges(stairs: readonly DungeonStair[]): PinnedEdge[] {
  return stairs.flatMap((stair) => cellsOf(spotRect(stair)).flatMap((c) => SIDES.map((side) => edgeOn(c, side))));
}

/**
 * The floor shapes of a cave floor showing `rooms` and `doors`: one poly per piece of floor,
 * kept for the next call on the same floor and the same rooms shown.
 */
export function caveFloorShapes(model: DungeonModel, index: number, rooms: readonly DungeonRoom[], doors: readonly DungeonDoor[]): FloorShape[] {
  const floor = model.floors[index] ?? model.floors[0];
  const owner = floor ?? model;
  const key = rooms.map((room) => room.id).join(',');
  let shapes = memo.get(owner)?.get(key);
  if (shapes) return shapes;
  const cells = [...rooms.flatMap((room) => floorCellsOf(room)), ...doors.filter((door) => door.kind !== 'secret').flatMap(doorCells)];
  const own = new Set(cells.map((c) => cellKey(c.x, c.y)));
  shapes = cells.length ? caveOutline(model.seed, index, (x, y) => own.has(cellKey(x, y)), gridOver(cells, 1), [...pinnedEdges(doors), ...stairEdges(floor?.stairs ?? [])]) : [];
  const byRooms = memo.get(owner) ?? new Map<string, FloorShape[]>();
  byRooms.set(key, shapes);
  memo.set(owner, byRooms);
  return shapes;
}
