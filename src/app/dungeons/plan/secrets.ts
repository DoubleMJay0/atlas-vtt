/**
 * Secret wings: small dead-end branches of the regular wing behind a secret door. Doors inside
 * become doorways, and each wing holds loot or, more often, an event.
 */

import type { DungeonParams } from '../params';
import { type Rng, chance, pick, shuffled } from '../rng';
import {
  GATED_ZONE,
  REGULAR_ZONE,
  type WorkLayout,
  isNormal,
  liveRooms,
  roomAt,
  subtree,
  treeDoorInto,
} from '../layout/workLayout';
import type { Culmination } from './culmination';
import { type FeatureMap, addFeature } from './features';

/** Secret wing zones count up from here. */
const FIRST_SECRET_ZONE = GATED_ZONE + 1;

function wingCount(rng: Rng, params: DungeonParams): number {
  const { chance: p, extra } = params.secretWings;
  if (!chance(rng, p)) return 0;
  let count = 1;
  if (chance(rng, extra)) count++;
  if (count === 2 && chance(rng, extra * extra)) count++;
  return count;
}

function isCandidate(layout: WorkLayout, id: number, culmination: Culmination, limit: number): boolean {
  if (id === 0) return false;
  const wing = subtree(layout, id);
  if (wing.length > limit || (culmination.front !== null && wing.includes(culmination.front))) return false;
  if (!wing.every((member) => roomAt(layout, member).zone === REGULAR_ZONE)) return false;
  return wing.some((member) => isNormal(roomAt(layout, member)));
}

function hideWing(rng: Rng, layout: WorkLayout, root: number, zone: number, features: FeatureMap): void {
  const wing = subtree(layout, root);
  const members = new Set(wing);
  for (const id of wing) {
    const room = roomAt(layout, id);
    room.wing = 'secret';
    room.zone = zone;
  }
  for (const door of layout.doors) {
    const inside = door.from !== null && door.to !== null && members.has(door.from) && members.has(door.to);
    if (inside && door.kind === 'door') door.kind = 'doorway';
  }
  const entrance = treeDoorInto(layout, root);
  if (entrance) entrance.kind = 'secret';
  const holder = pick(rng, wing.filter((id) => isNormal(roomAt(layout, id))));
  addFeature(features, holder, chance(rng, 1 / 3) ? { kind: 'loot' } : { kind: 'event' });
}

export function placeSecretWings(rng: Rng, layout: WorkLayout, params: DungeonParams, culmination: Culmination, features: FeatureMap): void {
  const count = wingCount(rng, params);
  if (count === 0) return;
  const limit = Math.max(3, Math.ceil(liveRooms(layout).length / 6));
  let zone = FIRST_SECRET_ZONE;
  for (const room of shuffled(rng, liveRooms(layout))) {
    if (zone - FIRST_SECRET_ZONE >= count) return;
    if (!isCandidate(layout, room.id, culmination, limit)) continue;
    hideWing(rng, layout, room.id, zone++, features);
  }
}
