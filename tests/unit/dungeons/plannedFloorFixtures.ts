import type { PlannedFloor } from '../../../src/app/dungeons/floors/planFloors';
import type { CellDir, DoorKind, DungeonDoor, DungeonRoom, DungeonStair, RoomKind } from '../../../src/app/dungeons/model';

/** Floors built by hand for the room-type tests: rooms by rectangle, doors by the rooms they join. */

export interface RoomShape {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: RoomKind;
  boss?: boolean;
  wing?: DungeonRoom['wing'];
  colonnade?: boolean;
  rotunda?: boolean;
  axis?: CellDir;
}

export function room(id: number, shape: RoomShape): DungeonRoom {
  return {
    id,
    x: shape.x,
    y: shape.y,
    w: shape.w,
    h: shape.h,
    kind: shape.kind ?? 'room',
    rotunda: shape.rotunda ?? false,
    wing: shape.wing ?? 'regular',
    group: id,
    parent: id === 0 ? null : 0,
    axis: shape.axis ?? { x: 0, y: 1 },
    colonnade: shape.colonnade ?? false,
    boss: shape.boss ?? false,
  };
}

/** A floor of `shapes` (ids in order) joined by `links` ([from, to, x, y]); an entrance opens into room 0. */
export function plannedFloor(shapes: readonly RoomShape[], links: readonly (readonly [number, number, number, number, DoorKind?])[], stairs: DungeonStair[] = [], entrance = true): PlannedFloor {
  const rooms = shapes.map((shape, id) => room(id, shape));
  const doors: DungeonDoor[] = links.map(([from, to, x, y, kind]) => ({ x, y, dir: { x: 1, y: 0 }, kind: kind ?? 'door', from, to }));
  if (entrance) doors.unshift({ x: shapes[0]!.x, y: shapes[0]!.y - 1, dir: { x: 0, y: 1 }, kind: 'opening', from: null, to: 0 });
  return { rooms, doors, stairs };
}

/** Five 4 × 4 rooms in a row, each door to the next. */
export function rowOfFive(): PlannedFloor {
  return plannedFloor(
    [0, 1, 2, 3, 4].map((k) => ({ x: k * 5, y: 0, w: 4, h: 4, axis: { x: 1, y: 0 } })),
    [0, 1, 2, 3].map((k) => [k, k + 1, k * 5 + 4, 1] as const),
  );
}

/**
 * An entrance room, a hub beyond it with three branches: a room east, a room south past a
 * corridor, a room north. Ids: 0 entrance, 1 hub, 2 east, 3 corridor, 4 south, 5 north.
 */
export function hubWithBranches(): PlannedFloor {
  return plannedFloor(
    [
      { x: 0, y: 0, w: 4, h: 4 },
      { x: 5, y: 0, w: 6, h: 6 },
      { x: 12, y: 0, w: 4, h: 4 },
      { x: 7, y: 7, w: 1, h: 3, kind: 'corridor' },
      { x: 5, y: 11, w: 5, h: 4 },
      { x: 5, y: -5, w: 6, h: 4 },
    ],
    [
      [0, 1, 4, 1],
      [1, 2, 11, 1],
      [1, 3, 7, 6],
      [3, 4, 7, 10],
      [1, 5, 7, -1],
    ],
  );
}
