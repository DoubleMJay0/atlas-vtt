import type { SceneLighting, SceneLightingChanges } from '../types/lightingTypes';
import { firstLevelId, hasLevels, type SceneLevels } from '../levels/sceneLevels';
import { unexploredImageOf } from './sceneLightingOptions';

/** What a scene's fog maps depend on: its lighting, which holds them, and its levels. */
export interface FogMapScene {
  lighting: Pick<SceneLighting, 'unexploredImage' | 'levelUnexploredImages'>;
  levels?: SceneLevels;
}

/** Whether `levelId` is the level whose fog map is the scene's own (`SceneLighting.unexploredImage`): the first, or the one of a scene without levels. */
function isFirstLevel(scene: FogMapScene, levelId: string | null): boolean {
  return !hasLevels(scene.levels) || levelId === null || levelId === firstLevelId(scene.levels);
}

/** The vault path of level `levelId`'s fog map for never-seen areas, or null where it has none it could read. */
export function levelUnexploredImage(scene: FogMapScene, levelId: string | null): string | null {
  if (isFirstLevel(scene, levelId)) return unexploredImageOf(scene.lighting);
  const path: unknown = scene.lighting.levelUnexploredImages?.[levelId!];
  return typeof path === 'string' && path.trim() !== '' ? path : null;
}

/** The change to the scene's lighting that gives level `levelId` the fog map `path`, or takes its fog map away (null). */
export function levelUnexploredImageChanges(scene: FogMapScene, levelId: string | null, path: string | null): SceneLightingChanges {
  if (isFirstLevel(scene, levelId)) return { unexploredImage: path ?? undefined };
  const others = { ...scene.lighting.levelUnexploredImages };
  if (path === null) delete others[levelId!];
  else others[levelId!] = path;
  return { levelUnexploredImages: Object.keys(others).length > 0 ? others : undefined };
}
