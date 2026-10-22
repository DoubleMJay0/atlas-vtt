/** Keys for the gate, loot, the one event and the first room's environment. */

import { type Rng, shuffled, weighted } from '../rng';
import { GATED_ZONE, REGULAR_ZONE, type WorkLayout, type WorkRoom, childrenOf, isNormal, liveRooms } from '../layout/workLayout';
import type { Culmination } from './culmination';
import { type FeatureMap, addFeature, hasFeatures } from './features';

/** How many keys the gate wants: out of 11, none 2, one 4, two 2, three 2, four 1. */
const KEY_WEIGHTS: readonly (readonly [number, number])[] = [
  [0, 2],
  [1, 4],
  [2, 2],
  [3, 2],
  [4, 1],
];

function normalRooms(layout: WorkLayout, zones: readonly number[]): WorkRoom[] {
  return liveRooms(layout).filter((room) => room.id !== 0 && isNormal(room) && zones.includes(room.zone));
}

/** Keys lie in leaf rooms of the regular wing, up to four of them. */
export function placeKeysAndGate(rng: Rng, layout: WorkLayout, culmination: Culmination, features: FeatureMap): void {
  const front = culmination.front;
  if (front === null) return;
  const wanted = weighted(rng, KEY_WEIGHTS);
  const leaves = normalRooms(layout, [REGULAR_ZONE]).filter((room) => room.id !== front && childrenOf(layout, room.id).length === 0);
  const holders = shuffled(rng, leaves).slice(0, wanted);
  holders.forEach((room) => addFeature(features, room.id, { kind: 'key' }));
  addFeature(features, front, { kind: 'gate' });
}

/** About ln(normal rooms) rooms get loot, and one more an event; the first room sets the scene. */
export function placeLootAndEvent(rng: Rng, layout: WorkLayout, features: FeatureMap): void {
  addFeature(features, 0, { kind: 'environment' });
  const rooms = normalRooms(layout, [REGULAR_ZONE, GATED_ZONE]).filter((room) => !room.ending);
  const count = Math.max(1, Math.round(Math.log(liveRooms(layout).filter(isNormal).length)));
  const free = shuffled(rng, rooms).filter((room) => !hasFeatures(features, room.id));
  free.slice(0, count).forEach((room) => addFeature(features, room.id, { kind: 'loot' }));
  const eventRoom = free[count];
  if (eventRoom) addFeature(features, eventRoom.id, { kind: 'event' });
}
