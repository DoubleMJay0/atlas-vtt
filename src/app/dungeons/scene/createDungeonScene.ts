import { normalizePath, type App } from 'obsidian';
import { imageDimensions } from '../../imageProcessing/imageDimensions';
import { IMAGE_PRESETS, optimizeImage, type ProcessedImage } from '../../imageProcessing/imageProcessing';
import { writeMapScene, type MapSceneDeps } from '../../import/writeMapScene';
import type { AssetService } from '../../services/AssetService';
import { AssetThumbnailService, THUMBNAIL_SPEC } from '../../services/AssetThumbnailService';
import { INVALID_NAME_CHARACTERS } from '../../services/assetPaths';
import type { DungeonModel, DungeonRequest } from '../model';
import { DEFAULT_PX_PER_CELL, type MapLayout } from '../render/layoutSize';
import type { DungeonStyle, DungeonView } from '../style';
import { DungeonWorkerClient } from '../worker/DungeonWorkerClient';
import type { DungeonJob, DungeonRendered } from '../worker/dungeonJob';
import { dungeonNoteText, dungeonPins } from './dungeonNote';
import { dungeonScene } from './toScene';
import type { DungeonPlacement } from './toWalls';

export interface DungeonSceneDeps extends MapSceneDeps {
  /** Generates and draws the dungeon: the dungeon worker. */
  render: (job: DungeonJob) => Promise<DungeonRendered>;
  /** The map image as a map stores it, with its thumbnail: the image workers. */
  convertImage: (image: Blob) => Promise<ProcessedImage>;
}

export interface DungeonSceneOptions {
  request: DungeonRequest;
  /** The dungeon as the GM last saw it (edited or moved notes); unset generates it from `request`. */
  model?: DungeonModel;
  style: DungeonStyle;
  view: DungeonView;
  collectionId: string;
  /** Pixels per cell of the map image; less where the image would pass a map's limits. */
  pxPerCell?: number;
  /** Room numbers on the map image; on unless set false. */
  numbers?: boolean;
}

export type DungeonSceneResult = { ok: true; name: string; scenePath: string; notePath: string } | { ok: false; problem: string };

const refused = (problem: string): DungeonSceneResult => ({ ok: false, problem });

const COLLECTION_GONE = 'The collection no longer exists. Choose another collection and try again.';
const NOT_DRAWN = 'The dungeon could not be drawn.';
const CROWDED_WALLS = 'The dungeon\'s walls end too close together for Atlas to join them.';
const INVALID_CHARACTERS = new RegExp(INVALID_NAME_CHARACTERS.source, 'g');

/** A dungeon's title as a vault file may be called. */
export function dungeonSceneName(title: string): string {
  const name = title.replace(INVALID_CHARACTERS, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim();
  return name || 'Dungeon';
}

/** The first of `name.md`, `name 2.md`… that is no file in `folder` yet. */
async function freeNotePath(app: App, folder: string, name: string): Promise<string> {
  for (let number = 1; ; number++) {
    const path = normalizePath(`${folder}/${number === 1 ? name : `${name} ${number}`}.md`);
    if (!(await app.vault.adapter.exists(path))) return path;
  }
}

/** Where the saved image lies on the grid: the layout's cells, at the pixels per cell of the image as it was saved. */
function placementOn(layout: MapLayout, saved: { width: number }): DungeonPlacement {
  const pxPerCell = saved.width === layout.widthPx ? layout.pxPerCell : saved.width / layout.cellsWide;
  return { originCell: layout.originCell, pxPerCell };
}

async function create(deps: DungeonSceneDeps, options: DungeonSceneOptions): Promise<DungeonSceneResult> {
  const { style, view } = options;
  const collection = await deps.assetService.getCollection(options.collectionId);
  if (!collection) return refused(COLLECTION_GONE);

  const rendered = await deps.render({
    request: options.request,
    ...(options.model && { model: options.model }),
    style,
    view,
    output: { kind: 'map', pxPerCell: options.pxPerCell ?? DEFAULT_PX_PER_CELL, numbers: options.numbers ?? true },
  });
  const { model, map: layout, image: drawn } = rendered;
  if (!layout || drawn.type !== 'png') return refused(NOT_DRAWN);

  const image = await deps.convertImage(drawn.blob);
  // A map within the limits is kept as drawn; one the workers scaled down has smaller cells
  const saved = (await imageDimensions(image.image)) ?? image.scaledDown?.to ?? { width: layout.widthPx, height: layout.heightPx };
  const placement = placementOn(layout, saved);
  const parts = dungeonScene(model, style, view, placement, saved);
  if (!parts) return refused(CROWDED_WALLS);
  if (parts.unplaced > 0) console.debug(`[Atlas] ${model.title}: ${parts.unplaced} doors had no walls beside them and were left open`);

  let notePath = '';
  const written = await writeMapScene(deps, {
    baseName: dungeonSceneName(model.title),
    collection,
    image,
    scene: parts.scene,
    finish: async ({ name, scenePath, content }) => {
      notePath = await freeNotePath(deps.app, scenePath.slice(0, scenePath.lastIndexOf('/')), name);
      content.state.objects = { ...content.state.objects, pins: dungeonPins(model, view, placement, notePath) };
      return [{ path: notePath, content: dungeonNoteText(model, view) }];
    },
  });
  if (!written.ok) return written;
  return { ok: true, name: written.name, scenePath: written.scenePath, notePath };
}

/**
 * Turns a dungeon into a scene of a collection: the floor plan as the map image, a grid that fits
 * it by construction, its walls and doors, dynamic lighting in daylight, a pin on every numbered
 * room, and a note beside the scene with the title, the story and the room key. All of it is
 * written together or not at all. Never throws: what went wrong comes back as a problem.
 */
export async function createDungeonSceneWith(deps: DungeonSceneDeps, options: DungeonSceneOptions): Promise<DungeonSceneResult> {
  try {
    return await create(deps, options);
  } catch (error) {
    console.error('[Atlas] Creating a dungeon scene failed', error);
    return refused('The dungeon could not be saved.');
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
