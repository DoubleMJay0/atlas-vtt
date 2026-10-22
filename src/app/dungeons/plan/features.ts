/** What the plan puts in a room; the props a room gets follow from it (`props/roomMarks.ts`). */
export type RoomFeature =
  | { kind: 'environment' }
  | { kind: 'enemy' }
  | { kind: 'loot' }
  | { kind: 'event' }
  /** The room in front of the locked gate. */
  | { kind: 'gate' }
  | { kind: 'key' }
  /** The room the rear entrance opens into. */
  | { kind: 'backdoor' }
  | { kind: 'stairs-down' };

/** What each room holds, by room id. */
export type FeatureMap = Map<number, RoomFeature[]>;

/** One feature of a kind per room. */
export function addFeature(features: FeatureMap, room: number, feature: RoomFeature): void {
  const list = features.get(room) ?? [];
  if (list.some((f) => f.kind === feature.kind)) return;
  list.push(feature);
  features.set(room, list);
}

export function hasFeatures(features: FeatureMap, room: number): boolean {
  return (features.get(room)?.length ?? 0) > 0;
}
