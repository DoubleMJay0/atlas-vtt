/**
 * Clean-up after loops: corridors and junctions that lead nowhere go, then corridors lose the
 * empty stretch beyond their last door.
 */

import type { FeatureMap } from '../plan/features';
import { type WorkLayout, type WorkRoom, doorsOf, isNormal, liveRooms, toLocal } from './workLayout';

function removeDeadEnds(layout: WorkLayout, features: FeatureMap): void {
  for (let changed = true; changed; ) {
    changed = false;
    for (const room of liveRooms(layout)) {
      if (room.id === 0 || isNormal(room) || features.has(room.id)) continue;
      const doors = doorsOf(layout, room.id);
      if (doors.length > 1) continue;
      room.removed = true;
      layout.doors = layout.doors.filter((door) => !doors.includes(door));
      changed = true;
    }
  }
}

/** A corridor without a door in its far wall ends just past its last side door. */
function trimCorridor(layout: WorkLayout, room: WorkRoom): void {
  const along = doorsOf(layout, room.id).map((door) => toLocal(room, door).i);
  if (along.includes(room.depth - 1)) return;
  const last = Math.max(1, ...along.filter((i) => i < room.depth - 1));
  room.depth = Math.max(3, last + 2);
}

export function cleanUp(layout: WorkLayout, features: FeatureMap): void {
  removeDeadEnds(layout, features);
  liveRooms(layout)
    .filter((room) => room.width === 3)
    .forEach((room) => trimCorridor(layout, room));
}
