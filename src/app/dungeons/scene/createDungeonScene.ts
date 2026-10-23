import type { App } from 'obsidian';
import { imageDimensions } from '../../imageProcessing/imageDimensions';
import { IMAGE_PRESETS, optimizeImage, type ProcessedImage } from '../../imageProcessing/imageProcessing';
import { mapSceneFile, writeMapScene, type MapSceneDeps, type MapToWrite } from '../../import/writeMapScene';
import { LEVEL_HEIGHT } from '../../levels/levelEdits';
import type { SceneLevel } from '../../types/sceneLevelTypes';
import type { AssetService } from '../../services/AssetService';
import { AssetThumbnailService, THUMBNAIL_SPEC } from '../../services/AssetThumbnailService';
import { t } from '../../i18n';
import { INVALID_NAME_CHARACTERS } from '../../services/assetPaths';
import type { DungeonModel, DungeonRequest } from '../model';
import { DEFAULT_PX_PER_CELL, type MapLayout } from '../render/layoutSize';
import type { DungeonStyle, DungeonView } from '../style';
import { DungeonWorkerClient } from '../worker/DungeonWorkerClient';
import type { DungeonJob, DungeonRendered } from '../worker/dungeonJob';
import { floorLetter } from './roomKeys';
import { dungeonNote, roomPins } from './toNote';
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

export type DungeonSceneResult =
  /** `entryLevel`: the entry floor's level, which the scene should open on; unset for a dungeon of one floor. */
  | { ok: true; name: string; scenePath: string; entryLevel?: string }
  | { ok: false; problem: string };

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

/** A floor as its level and its map name it: "Floor A". */
const floorName = (floor: number): string => t('dungeonScene.floor', { letter: floorLetter(floor) });

/**
 * The scene's levels, bottom first: the deepest floor first, the entry floor last, each a floor
 * high (the entry floor from 0 up, each floor below it one lower), each on its floor's map.
 */
function floorLevels(levelIds: readonly string[], backgrounds: readonly string[]): SceneLevel[] {
  return levelIds
    .map((id, floor): SceneLevel => ({
      id,
      name: floorName(floor),
      elevation: { bottom: -floor * LEVEL_HEIGHT, top: (1 - floor) * LEVEL_HEIGHT },
      background: backgrounds[floor] ?? null,
    }))
    .reverse();
}

interface DrawnFloors {
  model: DungeonModel;
  layout: MapLayout;
  /** Each floor's map as a map stores it, the entry floor first. */
  images: ProcessedImage[];
}

/**
 * Every floor's map at the same layout, each converted as a map stores it (conversions run while
 * the next floor is drawn). The first job generates the dungeon where no model was given; the
 * others draw that one. Null where a floor could not be drawn.
 */
async function drawFloors(deps: DungeonSceneDeps, options: DungeonSceneOptions): Promise<DrawnFloors | null> {
  const job = (model: DungeonModel | undefined, floor: number): DungeonJob => ({
    request: options.request,
    ...(model && { model }),
    style: options.style,
    view: options.view,
    output: { kind: 'map', pxPerCell: options.pxPerCell ?? DEFAULT_PX_PER_CELL, ...(floor > 0 && { floor }) },
  });
  const first: DungeonRendered = await deps.render(job(options.model, 0));
  const { model, map: layout } = first;
  const converting: Promise<ProcessedImage>[] = [];
  for (let floor = 0; floor < model.floors.length; floor++) {
    const { image } = floor === 0 ? first : await deps.render(job(model, floor));
    if (image.type !== 'png') return null;
    converting.push(deps.convertImage(image.blob));
  }
  return { model, layout, images: await Promise.all(converting) };
}

async function create(deps: DungeonSceneDeps, options: DungeonSceneOptions): Promise<DungeonSceneResult> {
  const { style, view } = options;
  const collection = await deps.assetService.getCollection(options.collectionId);
  if (!collection) return refused(t('dungeon.problem.collectionGone'));

  const drawn = await drawFloors(deps, options);
  if (!drawn) return refused(t('dungeon.problem.notDrawn'));
  const { model, layout, images } = drawn;
  // A map within the limits is kept as drawn; one the workers scaled down has smaller cells
  const sizes = await Promise.all(images.map(async (image) => (await imageDimensions(image.image)) ?? image.scaledDown?.to ?? { width: layout.widthPx, height: layout.heightPx }));
  const saved = sizes[0]!;
  // Every floor lies on one grid: their images must have one size
  if (sizes.some((size) => size.width !== saved.width || size.height !== saved.height)) return refused(t('dungeon.problem.notDrawn'));
  const placement = placementOn(layout, saved);
  const parts = dungeonScene(model, style, view, placement, saved);
  if (!parts) return refused(t('dungeon.problem.crowdedWalls'));
  if (parts.unplaced > 0) console.debug(`[Atlas] ${options.name}: ${parts.unplaced} doors had no walls beside them and were left open`);

  const { levelIds, rooms } = parts;
  const settings = deps.assetService.getCollectionSettings(collection.id);
  const maps: MapToWrite[] = images.map((image, floor) => ({
    image,
    name: (scene) => (levelIds ? t('dungeonScene.mapName', { scene, floor: floorName(floor) }) : scene),
  }));
  const written = await writeMapScene(deps, {
    collection,
    baseName: dungeonSceneName(options.name),
    maps,
    note: { text: () => dungeonNote(options.name.trim() || dungeonSceneName(options.name), rooms) },
    content: (paths, notePath) => {
      const levels = levelIds && floorLevels(levelIds, paths);
      // The first level's map is the scene's background
      const background = levels?.[0]?.background ?? paths[0]!;
      return mapSceneFile(settings, background, { ...parts.scene, ...(levels && { levels }), pins: roomPins(rooms, notePath!) });
    },
  });
  if (!written.ok) {
    console.error('[Atlas] Saving a dungeon scene failed:', written.problem);
    return refused(t('dungeon.createFailed'));
  }
  return { ok: true, name: written.name, scenePath: written.scenePath, ...(levelIds?.[0] && { entryLevel: levelIds[0] }) };
}

/**
 * Turns a dungeon into a scene of a collection, named as the GM named it: each floor's plan as a
 * map image (a level per floor where there are several, with stairs between them), a grid that
 * fits it by construction, its walls and doors, the outlines of its tall objects, dynamic lighting
 * in daylight, and a note with a heading per room that a GM-only numbered pin in each room links.
 * All of it is written together or not at all. Never throws: what went wrong comes back as a problem.
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
