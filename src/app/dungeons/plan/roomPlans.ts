import type { DungeonRoom } from '../model';
import type { RoomPlan } from '../text/contract';
import type { FeatureMap } from './features';

/** What the text module may know of each room. */
export function roomPlans(rooms: readonly DungeonRoom[], features: FeatureMap): RoomPlan[] {
  return rooms.map((room) => ({
    room: room.id,
    area: room.w * room.h,
    corridor: room.kind !== 'room',
    rotunda: room.rotunda,
    inSecretWing: room.wing === 'secret',
    ending: room.ending,
    features: [...(features.get(room.id) ?? [])],
  }));
}
