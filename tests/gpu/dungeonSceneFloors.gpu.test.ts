import { afterAll, describe, expect, it, vi } from 'vitest';
import { generateDungeon } from '../../src/app/dungeons/generate';
import { paletteOf, parseHex } from '../../src/app/dungeons/render/palette';
import { createDungeonSceneWith, type DungeonSceneDeps } from '../../src/app/dungeons/scene/createDungeonScene';
import { DEFAULT_VIEW } from '../../src/app/dungeons/style';
import { dungeonStyle } from '../../src/app/dungeons/styleCatalog';
import { runDungeonJob } from '../../src/app/dungeons/worker/dungeonJob';
import { IMAGE_PRESETS, disposeImageProcessing, optimizeImage } from '../../src/app/imageProcessing/imageProcessing';
import { linkTargets } from '../../src/app/levels/levelLinks';
import { AssetService } from '../../src/app/services/AssetService';
import { AssetThumbnailService, THUMBNAIL_SPEC } from '../../src/app/services/AssetThumbnailService';
import type { LevelLink, SceneLevel } from '../../src/app/types/sceneLevelTypes';
import { createInMemoryApp, interceptWrites } from '../mocks/inMemoryVault';
import { inkMask, type Picture } from './dungeonFidelityChecks';

vi.mock('../../src/app/pixi/mapImage/prebuildMapImage', () => ({ prebuildMapImageAt: vi.fn() }));

/**
 * A dungeon of three floors made into a scene with the real renderer and image workers: one map
 * per level, all of one size so they lie over each other, and stairs on exactly the drawn
 * stairwells of both floors they join.
 */

const COLLECTION = 'Dungeons';
const PX_PER_CELL = 60;
const STYLE = dungeonStyle('parchment');

afterAll(() => disposeImageProcessing());

async function pictureOf(bytes: ArrayBuffer): Promise<Picture> {
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return { data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data, width: bitmap.width, height: bitmap.height };
}

/** The share of a rectangle's border (its edges, 2 px either side) the picture inks: a stairwell is drawn boxed. */
function inkedBorder(mask: Uint8Array, picture: Picture, polygon: LevelLink['polygon']): number {
  const [x0, x1] = [Math.min(...polygon.map(p => p.x)), Math.max(...polygon.map(p => p.x))];
  const [y0, y1] = [Math.min(...polygon.map(p => p.y)), Math.max(...polygon.map(p => p.y))];
  const inked = (x: number, y: number): boolean => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (mask[(Math.round(y) + dy) * picture.width + Math.round(x) + dx]) return true;
    return false;
  };
  const samples: boolean[] = [];
  for (let x = x0 + 4; x <= x1 - 4; x += 2) samples.push(inked(x, y0), inked(x, y1));
  for (let y = y0 + 4; y <= y1 - 4; y += 2) samples.push(inked(x0, y), inked(x1, y));
  return samples.filter(Boolean).length / samples.length;
}

describe('a generated dungeon of three floors in its scene', () => {
  it('has a map per floor of one size and stairs that join the floors they are drawn on', async () => {
    const vault = createInMemoryApp();
    AssetService.resetInstance();
    const assets = AssetService.getInstance(vault.app);
    await assets.initialize();
    await assets.createCollection(COLLECTION);
    const binaries = new Map<string, ArrayBuffer>();
    const keep = (path: string, content: unknown): void => { if (content instanceof ArrayBuffer) binaries.set(path, content); };
    interceptWrites(vault.app.vault, 'createBinary', keep);
    interceptWrites(vault.app.vault.adapter, 'writeBinary', keep);
    const deps: DungeonSceneDeps = {
      app: vault.app,
      assetService: assets,
      render: runDungeonJob,
      convertImage: (image) => optimizeImage(image, IMAGE_PRESETS.map, { thumbnail: THUMBNAIL_SPEC }),
      thumbnails: new AssetThumbnailService(vault.app, assets),
    };
    const model = generateDungeon({ seed: 404, tags: ['small'], floors: 3 });

    const result = await createDungeonSceneWith(deps, { name: 'Deep Halls', request: { seed: 404, tags: ['small'], floors: 3 }, model, style: STYLE, view: DEFAULT_VIEW, collectionId: COLLECTION, pxPerCell: PX_PER_CELL });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { state } = JSON.parse(vault.files.get(result.scenePath)!) as { state: { levels: SceneLevel[]; objects: { levelLinks: Record<string, LevelLink> } } };
    const levels = state.levels;
    expect(levels.map(level => level.name)).toEqual(['Floor C', 'Floor B', 'Floor A']);
    expect(result.entryLevel).toBe(levels[2]!.id);
    const pictures = await Promise.all(levels.map(level => pictureOf(binaries.get(level.background!)!)));
    // Every floor's map has the one layout: same size, so frame levels lie over each other exactly
    for (const picture of pictures) expect([picture.width, picture.height]).toEqual([pictures[0]!.width, pictures[0]!.height]);

    const ink = parseHex(paletteOf(STYLE, DEFAULT_VIEW).ink);
    const masks = pictures.map(picture => inkMask(picture, ink));
    const byFloor = [2, 1, 0].map(index => levels[index]!.id);
    const links = Object.values(state.objects.levelLinks);
    const stairwells = model.floors.flatMap((floor, index) => floor.stairs.filter(s => s.to > index).map(stair => ({ stair, index })));
    expect(links).toHaveLength(stairwells.length);
    for (const { stair, index } of stairwells) {
      const link = state.objects.levelLinks[`levellink_dungeon_${stair.link}`]!;
      expect(link.levels).toEqual([byFloor[index], byFloor[stair.to]]);
      expect(linkTargets(link, byFloor[index]!, levels)).toEqual([byFloor[stair.to]]);
      expect(linkTargets(link, byFloor[stair.to]!, levels)).toEqual([byFloor[index]]);
      // Both floors' maps draw the stairwell boxed on exactly the stairs' rectangle
      for (const floor of [index, stair.to]) {
        const at = levels.findIndex(level => level.id === byFloor[floor]);
        expect(inkedBorder(masks[at]!, pictures[at]!, link.polygon), `stairwell ${stair.link} on floor ${floor}`).toBeGreaterThan(0.7);
      }
    }
  });
});
