import type { App } from 'obsidian';
import { imageDimensions } from '../../imageProcessing/imageDimensions';
import { IMAGE_PRESETS, optimizeImage, type ProcessedImage } from '../../imageProcessing/imageProcessing';
import { mapSceneFile, writeMapScene, type MapSceneDeps } from '../../import/writeMapScene';
import type { AssetService } from '../../services/AssetService';
import { AssetThumbnailService, THUMBNAIL_SPEC } from '../../services/AssetThumbnailService';
import { t } from '../../i18n';
import { INVALID_NAME_CHARACTERS } from '../../services/assetPaths';
import type { DungeonModel, DungeonRequest } from '../model';
import { DEFAULT_PX_PER_CELL, type MapLayout } from '../render/layoutSize';
import type { DungeonStyle, DungeonView } from '../style';
import { DungeonWorkerClient } from '../worker/DungeonWorkerClient';
import type { DungeonJob, DungeonRendered } from '../worker/dungeonJob';
import { dungeonScene } from './toScene';
import type { DungeonPlacement } from './toWalls';

export interface DungeonSceneDeps extends MapSceneDeps {
  /** Generates and draws the dungeon: the dungeon worker. */
  render: (job: DungeonJob) => Promise<DungeonRendered>;
  /** The map image as a map stores it, with its thumbnail: the image workers. */
  convertImage: (image: Blob) => Promise<ProcessedImage>;
}

export interface DungeonSceneOptions {
  /** What the scene and its map are called: the name the GM gave the dungeon. */
  name: string;
  request: DungeonRequest;
  /** The dungeon as the GM last saw it (wings hidden); unset generates it from `request`. */
  model?: DungeonModel;
  style: DungeonStyle;
  view: DungeonView;
  collectionId: string;
  /** Pixels per cell of the map image; less where the image would pass a map's limits. */
  pxPerCell?: number;
}

export type DungeonSceneResult = { ok: true; name: string; scenePath: string } | { ok: false; problem: string };

const refused = (problem: string): DungeonSceneResult => ({ ok: false, problem });

const INVALID_CHARACTERS = new RegExp(INVALID_NAME_CHARACTERS.source, 'g');

/** A dungeon's name as a vault file may be called. */
export function dungeonSceneName(given: string): string {
  const name = given.replace(INVALID_CHARACTERS, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim();
  return name || 'Dungeon';
}

/** Where the saved image lies on the grid: the layout's cells, at the pixels per cell of the image as it was saved. */
function placementOn(layout: MapLayout, saved: { width: number }): DungeonPlacement {
  const pxPerCell = saved.width === layout.widthPx ? layout.pxPerCell : saved.width / layout.cellsWide;
  return { originCell: layout.originCell, pxPerCell };
}

async function create(deps: DungeonSceneDeps, options: DungeonSceneOptions): Promise<DungeonSceneResult> {
  const { style, view } = options;
  const collection = await deps.assetService.getCollection(options.collectionId);
  if (!collection) return refused(t('dungeon.problem.collectionGone'));

  const rendered = await deps.render({
    request: options.request,
    ...(options.model && { model: options.model }),
    style,
    view,
    output: { kind: 'map', pxPerCell: options.pxPerCell ?? DEFAULT_PX_PER_CELL },
  });
  const { model, map: layout, image: drawn } = rendered;
  if (drawn.type !== 'png') return refused(t('dungeon.problem.notDrawn'));

  const image = await deps.convertImage(drawn.blob);
  // A map within the limits is kept as drawn; one the workers scaled down has smaller cells
  const saved = (await imageDimensions(image.image)) ?? image.scaledDown?.to ?? { width: layout.widthPx, height: layout.heightPx };
  const placement = placementOn(layout, saved);
  const parts = dungeonScene(model, style, view, placement, saved);
  if (!parts) return refused(t('dungeon.problem.crowdedWalls'));
  if (parts.unplaced > 0) console.debug(`[Atlas] ${options.name}: ${parts.unplaced} doors had no walls beside them and were left open`);

  const settings = deps.assetService.getCollectionSettings(collection.id);
  const written = await writeMapScene(deps, {
    collection,
    baseName: dungeonSceneName(options.name),
    maps: [{ image, name: (sceneName) => sceneName }],
    content: ([background]) => mapSceneFile(settings, background!, parts.scene),
  });
  if (!written.ok) {
    console.error('[Atlas] Saving a dungeon scene failed:', written.problem);
    return refused(t('dungeon.createFailed'));
  }
  return { ok: true, name: written.name, scenePath: written.scenePath };
}

/**
 * Turns a dungeon into a scene of a collection, named as the GM named it: the floor plan as the
 * map image, a grid that fits it by construction, its walls and doors and dynamic lighting in
 * daylight. All of it is written together or not at all. Never throws: what went wrong comes back
 * as a problem.
 */
export async function createDungeonSceneWith(deps: DungeonSceneDeps, options: DungeonSceneOptions): Promise<DungeonSceneResult> {
  try {
    return await create(deps, options);
  } catch (error) {
    console.error('[Atlas] Creating a dungeon scene failed', error);
    return refused(t('dungeon.createFailed'));
  }
}

/** `createDungeonSceneWith` on the app's dungeon worker and image workers; the asset manager is told of the new scene. */
export async function createDungeonScene(app: App, assetService: AssetService, options: DungeonSceneOptions): Promise<DungeonSceneResult> {
  const client = DungeonWorkerClient.forApp(app);
  const result = await createDungeonSceneWith(
    {
      app,
      assetService,
      render: (job) => client.render(job),
      convertImage: (image) => optimizeImage(image, IMAGE_PRESETS.map, { thumbnail: THUMBNAIL_SPEC }),
      thumbnails: AssetThumbnailService.getInstance(app, assetService),
    },
    options,
  );
  if (result.ok) app.workspace.trigger('atlas-vtt:refresh-assets');
  return result;
}
