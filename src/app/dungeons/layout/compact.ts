/** Turns the finished work layout into the model's rooms and doors, numbering rooms afresh. */

import type { DungeonDoor, DungeonRoom } from '../model';
import type { FeatureMap } from '../plan/features';
import { type WorkLayout, floorOf, kindOf, liveRooms } from './workLayout';

export interface CompactLayout {
  rooms: DungeonRoom[];
  doors: DungeonDoor[];
  features: FeatureMap;
}

export function compactLayout(layout: WorkLayout, features: FeatureMap): CompactLayout {
  const live = liveRooms(layout);
  const ids = new Map(live.map((room, index) => [room.id, index]));
  const renumber = (id: number | null): number | null => (id === null ? null : (ids.get(id) ?? null));
  const rooms = live.map((room): DungeonRoom => {
    const floor = floorOf(room);
    return {
      id: ids.get(room.id) ?? 0,
      x: floor.x0,
      y: floor.y0,
      w: floor.x1 - floor.x0 + 1,
      h: floor.y1 - floor.y0 + 1,
      kind: kindOf(room),
      rotunda: room.rotunda,
      ending: room.ending,
      wing: room.wing,
      group: room.group,
      parent: renumber(room.parent),
      axis: room.axis,
      colonnade: room.colonnade,
    };
  });
  const doors = layout.doors.map(
    (door): DungeonDoor => ({ x: door.x, y: door.y, dir: door.dir, kind: door.kind, from: renumber(door.from), to: renumber(door.to) }),
  );
  const renumbered: FeatureMap = new Map();
  features.forEach((list, id) => {
    const at = ids.get(id);
    if (at !== undefined) renumbered.set(at, list);
  });
  return { rooms, doors, features: renumbered };
}
