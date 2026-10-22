/** Rooms, doors and what each room holds, in the order each pass needs the ones before it. */

import type { DungeonParams } from '../params';
import { planDungeon } from '../plan/plan';
import { cleanUp } from './cleanup';
import { type CompactLayout, compactLayout } from './compact';
import { growLayout } from './grow';
import { growPass } from './growPass';
import { addLoops } from './loops';
import { shapeRooms } from './roomShapes';
import { addSteps } from './steps';

export function buildDungeonLayout(seed: number, params: DungeonParams): CompactLayout {
  const layout = growLayout(seed, params);
  growPass(seed, layout);
  const plan = planDungeon(seed, layout, params);
  addLoops(seed, layout, params);
  cleanUp(layout, plan.features);
  addSteps(seed, layout, params);
  shapeRooms(seed, layout, params);
  return compactLayout(layout, plan.features);
}
