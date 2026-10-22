/**
 * Decides what the dungeon is for: where it ends, what is locked, what is hidden, and what each
 * room holds. Runs on the grown tree, before loops, and writes wings and door kinds into it.
 */

import type { DungeonParams } from '../params';
import { stream } from '../rng';
import { costsFromEntrance } from '../layout/costs';
import type { WorkLayout } from '../layout/workLayout';
import { type Culmination, placeCulmination } from './culmination';
import { placeBackdoor, placeStairsDown } from './exits';
import type { FeatureMap } from './features';
import { placeKeysAndGate, placeLootAndEvent } from './rewards';
import { placeSecretWings } from './secrets';

export interface DungeonPlan {
  culmination: Culmination;
  features: FeatureMap;
}

export function planDungeon(seed: number, layout: WorkLayout, params: DungeonParams): DungeonPlan {
  const rng = stream(seed, 'plan');
  const features: FeatureMap = new Map();
  const costs = costsFromEntrance(layout);
  const culmination = placeCulmination(rng, layout, costs, features);
  placeSecretWings(rng, layout, params, culmination, features);
  placeKeysAndGate(rng, layout, culmination, features);
  placeBackdoor(rng, layout, params, costs, features);
  placeStairsDown(rng, layout, params, culmination.ending, features);
  placeLootAndEvent(rng, layout, features);
  return { culmination, features };
}
