import { normalizePath, type App } from 'obsidian';
import type { ProcessedImage } from '../imageProcessing/imageProcessing';
import { prebuildMapImageAt } from '../pixi/mapImage/prebuildMapImage';
import { AssetService, type CollectionMetadata, type MapAsset, type SceneAsset } from '../services/AssetService';
import type { AssetThumbnailService } from '../services/AssetThumbnailService';
import { discardAssetFiles, writeAssetImage } from '../services/assetImageFiles';
import { collectionFolderPath } from '../services/assetPaths';
import { TransferFiles } from '../services/assetTransfer/transferFiles';
import { newSceneFile, type NewSceneFile } from '../services/newSceneFile';
import { JSON_FOLDERS, defaultJsonPath } from '../services/vault-sync/assetFiles';
import type { GridState } from '../types/gridTypes';
import type { LightSource, SceneLighting } from '../types/lightingTypes';
import type { WallSegment } from '../types/wallTypes';

export interface MapSceneDeps {
  app: App;
  assetService: AssetService;
  thumbnails: Pick<AssetThumbnailService, 'tryThumbnailForImage'>;
}

/** What a map brings to its scene: a grid that fits its image, and what stands on it, in world pixels. */
export interface MapSceneParts {
  grid: Pick<GridState, 'size' | 'offsetX' | 'offsetY'>;
  walls: Record<string, WallSegment>;
  lights: Record<string, LightSource>;
  lighting: SceneLighting;
}

/** A file written along with the scene, and taken back with it. */
export interface CompanionFile {
  path: string;
  content: string;
}

export interface MapScenePlan {
  baseName: string;
  collection: CollectionMetadata;
  image: ProcessedImage;
  scene: MapSceneParts;
  /**
   * Last changes to the scene file once its name is known, and files that belong with it (a
   * dungeon's note). Runs under the lock, before anything is committed.
   */
  finish?: (written: { name: string; scenePath: string; content: NewSceneFile }) => Promise<CompanionFile[]> | CompanionFile[];
}

export type MapSceneWritten = { ok: true; name: string; scenePath: string } | { ok: false; problem: string };

const COLLECTION_GONE = 'The collection no longer exists. Choose another collection and try again.';

/** The first of `base`, `base 2`, `base 3`… no scene file in `folder` carries, however its letters are cased. */
async function freeSceneName(app: App, folder: string, base: string): Promise<string> {
  for (let number = 1; ; number++) {
    const name = number === 1 ? base : `${base} ${number}`;
    if (!(await app.vault.adapter.exists(normalizePath(`${folder}/${name}.atlasmap`)))) return name;
  }
}

/**
 * Writes a map and its scene: the image and its thumbnail, the scene file with the grid and what
 * stands on the map, the plan's companion files, and both records in one save of the index. All
 * of it happens under the index lock, so the vault check never sees the new scene without its
 * record and adds a second one. A failure takes back every file written so far, still under the
 * lock, and leaves the index as it was.
 */
export function writeMapScene({ app, assetService, thumbnails }: MapSceneDeps, plan: MapScenePlan): Promise<MapSceneWritten> {
  const { collection, scene } = plan;
  return assetService.runExclusive(async (): Promise<MapSceneWritten> => {
    // Deleted while the image was converted: writing now would bring its folders back
    if (!(await assetService.getCollection(collection.id))) return { ok: false, problem: COLLECTION_GONE };
    const files = new TransferFiles(app);
    const images: string[] = [];
    try {
      const mapFilePath = await writeAssetImage(app, plan.baseName, await plan.image.image.arrayBuffer());
      images.push(mapFilePath);
      const thumbnailPath = await thumbnails.tryThumbnailForImage(mapFilePath, plan.image.thumbnail);
      if (thumbnailPath) images.push(thumbnailPath);

      const folder = `${collectionFolderPath(collection.id)}/${JSON_FOLDERS.scene}`;
      const name = await freeSceneName(app, folder, plan.baseName);
      const scenePath = normalizePath(`${folder}/${name}.atlasmap`);

      const content = newSceneFile(assetService.getCollectionSettings(collection.id), mapFilePath);
      // The map states its grid, so there is none to detect
      const { autoDetect: _autoDetect, ...grid } = content.state.grid;
      content.state.grid = { ...grid, ...scene.grid };
      content.state.objects = { ...content.state.objects, walls: scene.walls, lights: scene.lights };
      content.state.lighting = scene.lighting;
      const companions = plan.finish ? await plan.finish({ name, scenePath, content }) : [];
      await files.write(scenePath, JSON.stringify(content, null, 2));
      for (const companion of companions) await files.write(companion.path, companion.content);

      const now = Date.now();
      const identity = <T extends 'map' | 'scene'>(type: T): { id: string; type: T; filePath: string } => {
        const id = AssetService.newAssetId(type);
        return { id, type, filePath: defaultJsonPath(type, collection.id, id) };
      };
      const shared = { name, tags: [], collection: collection.id, createdAt: now, modifiedAt: now };
      const map: MapAsset = { ...identity('map'), ...shared, mapFilePath, ...(thumbnailPath && { thumbnailPath }) };
      const sceneRecord: SceneAsset = { ...identity('scene'), ...shared, data: { mapPath: scenePath } };
      for (const record of [map, sceneRecord]) {
        const recordFile = assetService.pendingRecordFile(record);
        if (recordFile) await files.write(recordFile.path, recordFile.content);
      }
      await assetService.commitAssetTransfer({ collectionId: collection.id, records: [map, sceneRecord], tags: [] });
      prebuildMapImageAt(app, mapFilePath);
      return { ok: true, name, scenePath };
    } catch (error) {
      console.error('[Atlas] Saving a new map and its scene failed', error);
      const left = await files.undo();
      await discardAssetFiles(app, images);
      left.push(...images.filter((path) => app.vault.getAbstractFileByPath(path) !== null));
      return {
        ok: false,
        problem: `The map could not be saved.${left.length > 0 ? ` These files could not be removed again: ${left.join(', ')}.` : ' Nothing was added.'}`,
      };
    }
  });
}
