import type { CellPoint, DungeonRoom } from '../model';
import { cellKey, cellsOf, floorRect } from '../geometry';
import { approachCells, doorApproaches, spotRect } from '../floors/stairSpots';
import { frameOf } from '../props/roomFrame';
import { PROP_REACH, isFree, roomSpace, type RoomSpace } from '../props/space';
import type { VisibleFloor } from '../render/visibleDungeon';

/** How far a pin reaches from its cell's middle, in cells: what must be clear for it. */
const PIN_REACH = 0.3;

/**
 * Where a room's pin stands: the middle of the free cell nearest the room's middle (in reading
 * order among equals). Free is off the stairwells and the rows they are reached from, the cells
 * before doors, every prop, column and piece of terrain, and dry. A room with no such cell takes
 * its middle cell's middle.
 */
export function pinCell(visible: VisibleFloor, room: DungeonRoom): CellPoint {
  const { floor } = visible;
  const clear = new Set([
    ...floor.stairs.flatMap(s => [...cellsOf(spotRect(s)), ...approachCells(s, s.to > visible.index ? 'upper' : 'lower')]),
    ...doorApproaches(room, visible.doors),
    ...floor.waterCells,
    ...floor.terrain.flatMap(piece => piece.cells),
  ].map(c => cellKey(c.x, c.y)));
  const frame = frameOf(room);
  const space: RoomSpace = roomSpace(frame, clear, floor.columns);
  for (const prop of floor.props) space.taken.push({ x: prop.x, y: prop.y, radius: PROP_REACH[prop.kind] * prop.scale });

  const middle = frame.centre;
  const centres = cellsOf(floorRect(room))
    .map(c => ({ x: c.x + 0.5, y: c.y + 0.5 }))
    .sort((a, b) => Math.hypot(a.x - middle.x, a.y - middle.y) - Math.hypot(b.x - middle.x, b.y - middle.y) || a.y - b.y || a.x - b.x);
  return centres.find(p => isFree(space, p, PIN_REACH)) ?? centres[0] ?? middle;
}
