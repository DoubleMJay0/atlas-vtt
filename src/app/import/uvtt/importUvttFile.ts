import { resolveMeasurementSettings } from '../../grid/measurementFormat';
import { imageDimensions } from '../../imageProcessing/imageDimensions';
import type { Size } from '../../imageProcessing/imageLayout';
import type { ProcessedImage } from '../../imageProcessing/imageProcessing';
import type { ScaleDown } from '../../imageProcessing/imageJob';
import { UVTT_TOO_LARGE, parseUvtt } from './parseUvtt';
import { wallsCrowd } from './uvttCrowding';
import { uvttSceneName } from './uvttFileNames';
import { COLLECTION_GONE, writeMapScene, type MapSceneDeps } from '../writeMapScene';
import { uvttCellSize, uvttToScene, type UvttCounts } from './uvttToScene';
import { UVTT_LIMITS, type UvttMap, type UvttRefusal } from './uvttTypes';

export interface UvttImportDeps extends MapSceneDeps {
  /** The file's image as a map stores it, with its thumbnail: the image workers. */
  convertImage: (image: Blob) => Promise<ProcessedImage>;
}

export interface UvttImported {
  ok: true;
  /** The name of the new map and of its scene. */
  name: string;
  scenePath: string;
  counts: UvttCounts;
  /** The lights were imported switched off, since the image shows their glow already. */
  lightsOff: boolean;
  /** Set when the image had more pixels than a map keeps. */
  scaledDown?: ScaleDown;
}

export type UvttImportResult = UvttImported | UvttRefusal;

const refused = (problem: string): UvttRefusal => ({ ok: false, problem });

const UNREADABLE_IMAGE = 'The map image in the file could not be read.';
const CROWDED_WALLS = 'The walls in the file end too close together in too many places for Atlas to join them.';

/**
 * World pixels a cell of the map spans on an image of `image` pixels, or why that image cannot
 * carry the map's grid: its cells would not be square, or too small to be a grid at all.
 */
function cellSizeOn(map: UvttMap, image: Size): number | UvttRefusal {
  const pixels = `${image.width} × ${image.height} pixels`;
  const squares = `${map.size.x} × ${map.size.y} squares`;
  const cellSize = uvttCellSize(map, image);
  if (cellSize === null) return refused(`The map image is ${pixels}, which does not fit a map of ${squares}.`);
  if (cellSize < UVTT_LIMITS.cellPixels) return refused(`The map image is too small for its grid: ${pixels} for ${squares}.`);
  return cellSize;
}

async function importFile(deps: UvttImportDeps, file: File, collectionId: string): Promise<UvttImportResult> {
  if (file.size > UVTT_LIMITS.fileBytes) return refused(UVTT_TOO_LARGE);
  const parsed = parseUvtt(await file.text());
  if (!parsed.ok) return parsed;
  const { map } = parsed;

  const source = new Blob([map.image.bytes], { type: map.image.type });
  const sourceSize = await imageDimensions(source);
  if (!sourceSize) return refused(UNREADABLE_IMAGE);
  if (sourceSize.width * sourceSize.height > UVTT_LIMITS.imagePixels) {
    return refused(`The map image is too large to open: ${sourceSize.width} × ${sourceSize.height} pixels.`);
  }
  const sourceCell = cellSizeOn(map, sourceSize);
  if (typeof sourceCell !== 'number') return sourceCell;

  const collection = await deps.assetService.getCollection(collectionId);
  if (!collection) return refused(COLLECTION_GONE);

  // Where things lie on the map does not depend on the size the image is saved at
  const unit = resolveMeasurementSettings(deps.assetService.getCollectionSettings(collection.id).gridDefaults, null);
  const placed = uvttToScene(map, { cellSize: sourceCell, unit });
  if (placed.onImage === 0 && placed.skipped.outside > 0) {
    return refused('Nothing in the file lies on its map image: its walls, doors and lights are all outside it.');
  }
  if (wallsCrowd(Object.values(placed.walls), sourceSize)) return refused(CROWDED_WALLS);

  let image: ProcessedImage;
  try {
    image = await deps.convertImage(source);
  } catch (error) {
    console.error('[Atlas] The image of a Universal VTT file could not be converted', error);
    return refused(UNREADABLE_IMAGE);
  }
  // The size the scene shows the image at: the saved image's own, which a large map's was scaled down to
  const size = (await imageDimensions(image.image)) ?? image.scaledDown?.to ?? sourceSize;
  const cellSize = cellSizeOn(map, size);
  if (typeof cellSize !== 'number') return cellSize;

  const scene = cellSize === sourceCell ? placed : uvttToScene(map, { cellSize, unit });
  // A map scaled down has its walls closer together
  if (scene !== placed && wallsCrowd(Object.values(scene.walls), size)) return refused(CROWDED_WALLS);
  if (Object.values(scene.skipped).some((count) => count > 0)) console.debug(`[Atlas] ${file.name}: left out what the map does not take`, scene.skipped);
  const written = await writeMapScene(deps, { baseName: uvttSceneName(file.name), collection, image, scene });
  if (!written.ok) return written;
  return {
    ...written,
    counts: scene.counts,
    lightsOff: map.bakedLighting && scene.counts.lights > 0,
    ...(image.scaledDown && { scaledDown: image.scaledDown }),
  };
}

/**
 * Imports a Universal VTT file into a collection as a map and a scene of the same name, with
 * the file's walls, doors and lights and dynamic lighting on. The file is untrusted: whatever
 * is wrong with it comes back as a problem in plain words, and an import that fails leaves
 * neither a file nor a record. Never throws.
 */
export async function importUvttFile(deps: UvttImportDeps, file: File, collectionId: string): Promise<UvttImportResult> {
  try {
    return await importFile(deps, file, collectionId);
  } catch (error) {
    console.error('[Atlas] Importing a Universal VTT file failed', error);
    return refused('The file could not be imported.');
  }
}
