import { everyLevelObjects, levelObjects, recordOnViewedLevel } from '../levels/levelObjects';
import { hasLevels, viewedLevelId, type LevelView, type SceneLevels } from '../levels/sceneLevels';
import type { FogOperation } from '../types/fogTypes';
import type { FogStyle } from './fogStyle';

type FogRecord = Readonly<Record<string, FogOperation>>;

/** What `heldFog` reads of a view's state. */
export interface FogHoldState {
  activeTool: string;
  isPlayerView: boolean;
  fogStyle: FogStyle;
  fogHeld: FogRecord | null;
  objects: { fog: FogRecord };
}

/**
 * The fog the players are kept on: under cloud reveal, while the GM's view has the fog or eraser
 * tool, the fog of every level from when the tool was taken up; otherwise none, and they see the fog as it is.
 */
export function heldFog(state: FogHoldState): FogRecord | null {
  const editing = state.activeTool === 'fog' || state.activeTool === 'eraser';
  if (!editing || state.isPlayerView || !state.fogStyle.clouds) return null;
  return state.fogHeld ?? everyLevelObjects(state).fog;
}

/** The held fog of each level, by hold, levels and level, so a level's result keeps its identity. */
const heldOnLevel = new WeakMap<FogRecord, WeakMap<NonNullable<SceneLevels>, Map<string, FogRecord>>>();

/**
 * The fog the players see, of the level the view shows (`levelObjects`). Everything that shows
 * them fog or decides by it reads this: the player frame, the tokens and door badges fog hides
 * from them, and what an online table sends. A hold keeps the fog of every level, so showing
 * another level while it lasts shows that level's fog from when the tool was taken up.
 */
export function playersFog(state: { fogHeld?: FogRecord | null | undefined; objects: { fog: FogRecord } } & LevelView): FogRecord {
  const held = state.fogHeld;
  if (!held) return levelObjects(state).fog;
  const { levels } = state;
  if (!hasLevels(levels)) return held;
  // Filtered apart from `levelObjects`, whose memory of a level's last result must stay the state's;
  // the level's fog itself while nothing on it was edited, so its coverage is the one worked out already
  const levelId = viewedLevelId(state) ?? '';
  let byLevels = heldOnLevel.get(held);
  if (!byLevels) heldOnLevel.set(held, byLevels = new WeakMap<NonNullable<SceneLevels>, Map<string, FogRecord>>());
  let byLevel = byLevels.get(levels);
  if (!byLevel) byLevels.set(levels, byLevel = new Map<string, FogRecord>());
  let fog = byLevel.get(levelId);
  if (!fog) byLevel.set(levelId, fog = recordOnViewedLevel(held, state, levelObjects(state).fog));
  return fog;
}
