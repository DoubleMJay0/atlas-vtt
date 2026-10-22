import type { RoomFeature } from '../text/contract';

/** What each room holds, by room id. */
export type FeatureMap = Map<number, RoomFeature[]>;

/** The order notes join their sentences in. */
const RANK: Record<RoomFeature['kind'], number> = {
  environment: 0,
  enemy: 1,
  backdoor: 2,
  event: 3,
  gate: 4,
  loot: 5,
  key: 6,
  'stairs-down': 7,
};

export function addFeature(features: FeatureMap, room: number, feature: RoomFeature): void {
  const list = features.get(room) ?? [];
  if (list.some((f) => f.kind === feature.kind)) return;
  list.push(feature);
  list.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
  features.set(room, list);
}

export function hasFeatures(features: FeatureMap, room: number): boolean {
  return (features.get(room)?.length ?? 0) > 0;
}
