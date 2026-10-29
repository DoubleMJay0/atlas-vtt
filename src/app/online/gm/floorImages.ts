import { ASSET_CAPS, MAX_ASSET_BYTES, type AssetRef } from '../protocol/index.ts';
import { imageDimensions } from '../../imageProcessing/imageDimensions';
import { isVideoMapPath } from '../../pixi/mapImage/video/videoMapFiles';
import type { PictureImage } from './assetAnswers.ts';
import { sha256Hex } from './assetServe.ts';
import { ASSET_USES, type AssetStoring } from './assets/assetUses.ts';
import type { MapSize } from './moveCheck.ts';
import type { VaultImage } from './TokenShare.ts';

/** A map image as read for sharing: its reference and bytes. */
export type SharedImage = PictureImage & { readonly ref: AssetRef };

/** What a floor's image was read as: the map with its size. */
export interface FloorImages {
  readonly map: SharedImage | null;
  readonly size: MapSize | null;
}

/** Why a floor's map cannot be sent: it cannot be read, or it is larger than players can be sent. */
export type FloorImageProblem = 'unreadable' | 'too-large';

/**
 * An image of the vault as players may be sent it: with an id where the store keeps it (up to its cap
 * for images), else within what the GM serves itself.
 */
async function sharedImage(readImage: (path: string) => Promise<VaultImage | null>, path: string, stored: AssetStoring | undefined): Promise<SharedImage | FloorImageProblem> {
  const image = await readImage(path);
  if (image === null) return 'unreadable';
  // A poster is drawn from its video, so it is kept rather than read again for the upload.
  const ref = stored === undefined ? { hash: await sha256Hex(image.bytes), size: image.bytes.length, mime: image.mime } : await stored.refOf(image.bytes, image.mime, ASSET_USES.map, isVideoMapPath(path) ? undefined : path);
  if (image.bytes.length > (ref.id === undefined ? MAX_ASSET_BYTES : ASSET_CAPS.image)) return 'too-large';
  return { hash: ref.hash, bytes: image.bytes, mime: image.mime, ref };
}

/** A floor's map (`background`, none for a floor without one) with its size, or why the map cannot be sent. */
export async function readFloorImages(readImage: (path: string) => Promise<VaultImage | null>, background: string | null, stored?: AssetStoring): Promise<FloorImages | FloorImageProblem> {
  if (background === null) return { map: null, size: null };
  const map = await sharedImage(readImage, background, stored);
  if (typeof map === 'string') return map;
  const size = await imageDimensions(new Blob([map.bytes]));
  return { map, size };
}
