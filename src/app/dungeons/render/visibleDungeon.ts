import type { DungeonDoor, DungeonModel, DungeonRoom } from '../model';
import type { DungeonView } from '../style';
import { doorShape, doorShapes, roomShape, shapeBounds, shapeDistance, unionBounds, type Bounds, type FloorShape } from './geometry';

/**
 * What a view shows of a dungeon: secret wings leave with their doors when secrets are hidden,
 * and a secret door is wall, so its cell is no floor.
 */
export interface VisibleDungeon {
  model: DungeonModel;
  rooms: DungeonRoom[];
  doors: DungeonDoor[];
  /** Room floors, then door cells (a doorway's narrowed by its jambs). */
  floors: FloorShape[];
  /** The floors with every door cell whole: what courses of brick and stone are laid around. */
  outlines: FloorShape[];
  roomShapes: Map<number, FloorShape>;
  field: FloorField;
  /** Of the floors. */
  bounds: Bounds;
}

export function visibleDungeon(model: DungeonModel, view: Pick<DungeonView, 'secrets'>): VisibleDungeon {
  const rooms = model.rooms.filter(room => view.secrets || room.wing !== 'secret');
  const shown = new Set(rooms.map(room => room.id));
  const doors = model.doors.filter(door => (door.from === null || shown.has(door.from)) && (door.to === null || shown.has(door.to)));
  const roomShapes = new Map(rooms.map(room => [room.id, roomShape(room)] as const));
  const open = doors.filter(door => door.kind !== 'secret');
  const floors = [...roomShapes.values(), ...open.flatMap(doorShapes)];
  const outlines = [...roomShapes.values(), ...open.map(doorShape)];
  const bounds = floors.length ? unionBounds(floors.map(shape => shapeBounds(shape))) : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { model, rooms, doors, floors, outlines, roomShapes, field: new FloorField(floors), bounds };
}

/** How far from the floors the field answers exactly; farther points read as this far. */
const REACH = 3;

/**
 * Signed distance to the union of the floors (negative inside), answered from an index of the
 * shapes near each cell, so sampling a large dungeon's surroundings stays cheap.
 */
export class FloorField {
  private readonly cells = new Map<number, FloorShape[]>();

  constructor(readonly shapes: readonly FloorShape[]) {
    for (const shape of shapes) {
      const b = shapeBounds(shape, REACH);
      for (let y = Math.floor(b.minY); y <= Math.floor(b.maxY); y++) {
        for (let x = Math.floor(b.minX); x <= Math.floor(b.maxX); x++) {
          const key = cellKey(x, y);
          const list = this.cells.get(key);
          if (list) list.push(shape);
          else this.cells.set(key, [shape]);
        }
      }
    }
  }

  distance(x: number, y: number): number {
    const list = this.cells.get(cellKey(Math.floor(x), Math.floor(y)));
    if (!list) return REACH;
    let best = REACH;
    for (const shape of list) best = Math.min(best, shapeDistance(shape, x, y));
    return best;
  }

  /** The direction away from the nearest floor, by central differences. */
  gradient(x: number, y: number): { x: number; y: number } {
    const e = 0.02;
    const gx = this.distance(x + e, y) - this.distance(x - e, y);
    const gy = this.distance(x, y + e) - this.distance(x, y - e);
    const len = Math.hypot(gx, gy) || 1;
    return { x: gx / len, y: gy / len };
  }
}

function cellKey(x: number, y: number): number {
  return (x + 32768) * 65536 + (y + 32768);
}
