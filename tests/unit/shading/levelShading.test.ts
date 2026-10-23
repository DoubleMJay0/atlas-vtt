import { describe, expect, it } from 'vitest';
import { levelShading, NO_SHADING, readShadingPath, sceneShadingPaths } from '../../../src/app/levels/levelShading';
import { withLevelAdded, withLevelRoof } from '../../../src/app/levels/levelEdits';
import { readSceneLevels, sceneImagePaths } from '../../../src/app/levels/levelFile';
import { rewriteMapReferences } from '../../../src/app/services/renamedPaths';
import type { SceneLevel } from '../../../src/app/types/sceneLevelTypes';

const LEVELS: SceneLevel[] = [
  { id: 'cellar', elevation: { bottom: -10, top: 0 }, background: 'maps/cellar.webp', relief: 'maps/cellar relief.png', shade: 'maps/cellar shade.png' },
  { id: 'hall', elevation: { bottom: 0, top: 10 }, background: 'maps/hall.webp', relief: 'maps/hall relief.png' },
];

describe('a level\'s shading', () => {
  it('is the scene\'s own without levels, each level\'s with them', () => {
    expect(levelShading({ relief: 'r.png', shade: 's.png' }, null)).toEqual({ relief: 'r.png', shade: 's.png' });
    expect(levelShading({ levels: LEVELS, relief: 'stale.png' }, 'hall')).toEqual({ relief: 'maps/hall relief.png', shade: null });
    // Null names the first level; a level the scene lacks has none.
    expect(levelShading({ levels: LEVELS }, null)).toEqual({ relief: 'maps/cellar relief.png', shade: 'maps/cellar shade.png' });
    expect(levelShading({ levels: LEVELS }, 'attic')).toBe(NO_SHADING);
    expect(levelShading({}, null)).toBe(NO_SHADING);
    expect(levelShading({ relief: '', shade: null }, null)).toBe(NO_SHADING);
  });

  it('goes with the scene\'s own map into the first level a scene without levels is made', () => {
    const scene = { background: 'maps/hall.webp', relief: 'r.png', shade: 's.png' };
    const [first, added] = withLevelAdded(scene, { name: 'Attic', background: 'maps/attic.webp' }, 'Ground');
    expect(first).toMatchObject({ background: 'maps/hall.webp', relief: 'r.png', shade: 's.png' });
    expect(added).not.toHaveProperty('relief');
    expect(withLevelRoof(scene, null, 'roof.png', 'Ground')![0]).toMatchObject({ relief: 'r.png', shade: 's.png', foreground: 'roof.png' });
    // A scene without shading makes a level without the fields.
    expect(withLevelAdded({ background: 'maps/hall.webp' }, { name: 'Attic', background: null }, 'Ground')[0]).not.toHaveProperty('relief');
  });

  it('is read from a file as text, anything else as none', () => {
    const read = readSceneLevels([{ ...LEVELS[0], relief: 7, shade: '' }, LEVELS[1]], 'maps/cellar.webp')!;
    expect(read[0]).not.toHaveProperty('relief');
    expect(read[0]).not.toHaveProperty('shade');
    expect(read[1]!.relief).toBe('maps/hall relief.png');
    expect(readShadingPath('a.png')).toBe('a.png');
    expect(readShadingPath(3)).toBeUndefined();
  });

  it('travels with the scene: bundles and transfers take its images, renames follow them', () => {
    const state = { background: 'maps/cellar.webp', relief: 'top relief.png', levels: LEVELS };
    expect(sceneShadingPaths(state).sort()).toEqual(['maps/cellar relief.png', 'maps/cellar shade.png', 'maps/hall relief.png', 'top relief.png']);
    expect(sceneImagePaths(state)).toEqual(expect.arrayContaining(['maps/cellar.webp', 'maps/hall.webp', 'maps/cellar relief.png', 'maps/cellar shade.png', 'maps/hall relief.png', 'top relief.png']));

    const map = structuredClone({ ...state, shade: 'top shade.png' });
    const moved = (path: string | null | undefined): string | null => (path?.startsWith('maps/') || path?.startsWith('top') ? `moved/${path}` : null);
    expect(rewriteMapReferences(map, moved)).toBe(true);
    expect(map.relief).toBe('moved/top relief.png');
    expect(map.shade).toBe('moved/top shade.png');
    expect(map.levels.map((level) => [level.relief, level.shade])).toEqual([['moved/maps/cellar relief.png', 'moved/maps/cellar shade.png'], ['moved/maps/hall relief.png', undefined]]);
  });
});
