import type { SceneLevel } from '../types/sceneLevelTypes';
import { isRecord } from '../utils/guards';
import { firstLevelId } from './sceneLevels';

/**
 * What lights a level's map besides its image (vault paths, null for one it has none of): its relief,
 * how high everything on it stands, from which the lighting casts each light's shadows; and its
 * shade, the shadows its image was drawn without, multiplied over it.
 */
export interface LevelShading {
  relief: string | null;
  shade: string | null;
}

/** What a scene holds its shading in: a scene without levels on itself, each level of one with levels on that level. */
export interface ShadedScene {
  levels?: readonly SceneLevel[] | undefined;
  relief?: string | null | undefined;
  shade?: string | null | undefined;
}

export const NO_SHADING: LevelShading = { relief: null, shade: null };

const path = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * The shading of level `id` (null: the scene's only one, or its first): a scene without levels holds
 * it itself; a level, on itself, the first one too. Compare what it gives by its paths.
 */
export function levelShading(scene: ShadedScene, id: string | null): LevelShading {
  const { levels } = scene;
  const holder = levels?.length ? levels.find((level) => level.id === (id ?? firstLevelId(levels))) : scene;
  const relief = path(holder?.relief);
  const shade = path(holder?.shade);
  return relief || shade ? { relief, shade } : NO_SHADING;
}

/** The scene's own shading as fields of a level: what a scene without levels gives the first level it is made. No field where it has none. */
export function shadingFields(scene: ShadedScene): Pick<SceneLevel, 'relief' | 'shade'> {
  const relief = path(scene.relief);
  const shade = path(scene.shade);
  return { ...(relief && { relief }), ...(shade && { shade }) };
}

/** Every relief and shade image a scene's file names, once each, read from the file's shape as it is (a snapshot, a newer version). */
export function sceneShadingPaths(state: unknown): string[] {
  if (!isRecord(state)) return [];
  const paths = new Set<string>();
  const add = (holder: unknown): void => {
    if (!isRecord(holder)) return;
    for (const value of [holder.relief, holder.shade]) {
      const read = path(value);
      if (read) paths.add(read);
    }
  };
  add(state);
  if (Array.isArray(state.levels)) state.levels.forEach(add);
  return [...paths];
}

/** A relief or shade path as a scene file holds it: unset where it is no path. */
export function readShadingPath(value: unknown): string | undefined {
  return path(value) ?? undefined;
}
