import { describe, expect, it } from 'vitest';
import { levelUnexploredImage, levelUnexploredImageChanges } from '../../src/app/lighting/levelUnexploredImages';
import { readSceneLighting } from '../../src/app/lighting/sceneLightingOptions';
import { DEFAULT_SCENE_LIGHTING, type SceneLighting } from '../../src/app/types/lightingTypes';
import type { SceneLevel } from '../../src/app/types/sceneLevelTypes';

const level = (id: string): SceneLevel => ({ id, elevation: { bottom: 0, top: 10 }, background: `${id}.png` });
const levels = [level('ground'), level('upper')];

describe('fog maps of levels', () => {
  it('reads the scene\'s own fog map for a scene without levels and for its first level', () => {
    const lighting: SceneLighting = { ...DEFAULT_SCENE_LIGHTING, unexploredImage: 'Maps/fog.png', levelUnexploredImages: { upper: 'Maps/upper-fog.png' } };
    expect(levelUnexploredImage({ lighting }, null)).toBe('Maps/fog.png');
    expect(levelUnexploredImage({ lighting, levels }, 'ground')).toBe('Maps/fog.png');
    expect(levelUnexploredImage({ lighting, levels }, 'upper')).toBe('Maps/upper-fog.png');
    expect(levelUnexploredImage({ lighting: DEFAULT_SCENE_LIGHTING, levels }, 'upper')).toBeNull();
  });

  it('sets and takes away a level\'s fog map without touching the others', () => {
    const lighting: SceneLighting = { ...DEFAULT_SCENE_LIGHTING, unexploredImage: 'Maps/fog.png' };
    expect(levelUnexploredImageChanges({ lighting, levels }, 'ground', 'Maps/new.png')).toEqual({ unexploredImage: 'Maps/new.png' });
    expect(levelUnexploredImageChanges({ lighting, levels }, 'ground', null)).toEqual({ unexploredImage: undefined });
    expect(levelUnexploredImageChanges({ lighting, levels }, 'upper', 'Maps/upper-fog.png')).toEqual({ levelUnexploredImages: { upper: 'Maps/upper-fog.png' } });
    const both = { ...lighting, levelUnexploredImages: { upper: 'Maps/upper-fog.png', attic: 'Maps/attic.png' } };
    expect(levelUnexploredImageChanges({ lighting: both, levels }, 'upper', null)).toEqual({ levelUnexploredImages: { attic: 'Maps/attic.png' } });
    expect(levelUnexploredImageChanges({ lighting: { ...lighting, levelUnexploredImages: { upper: 'x.png' } }, levels }, 'upper', null)).toEqual({ levelUnexploredImages: undefined });
  });

  it('keeps only the fog maps of levels that name a path when a scene is read', () => {
    expect(readSceneLighting({ enabled: true, levelUnexploredImages: { upper: 'Maps/a.png', bad: 3, empty: ' ' } }))
      .toEqual({ ...DEFAULT_SCENE_LIGHTING, enabled: true, levelUnexploredImages: { upper: 'Maps/a.png' } });
    expect(readSceneLighting({ enabled: true, levelUnexploredImages: ['Maps/a.png'] })).toEqual({ ...DEFAULT_SCENE_LIGHTING, enabled: true });
  });
});
