import { ASSET_CAPS, MAX_ASSET_BYTES, VIDEO_MIME_TYPES, type AssetRef } from '../protocol/index.ts';
import { sha256Hex } from './assetServe.ts';
import { ASSET_USES, type AssetStoring } from './assets/assetUses.ts';
import type { VaultImage } from './TokenShare.ts';

/** An animated map's video as shared: its reference, and where it lies, read again for each request so its bytes are not held. */
export interface SharedVideo {
  readonly ref: AssetRef;
  readonly path: string;
}

/**
 * The video of a floor's map (`background`) players may play in its poster's place, or null for a map
 * that is no video, or one that cannot be sent (too large, unreadable): players keep the poster.
 * Where the store keeps it (`stored`, the reference carries an id) a video may be up to the store's cap
 * for videos and is never read here but to hash it once per version of the file; the GM serves up to
 * `MAX_ASSET_BYTES` itself.
 */
export async function readFloorVideo(readVideo: (path: string) => Promise<VaultImage | null>, background: string | null, stored?: AssetStoring, mimeOf?: (path: string) => string | null): Promise<SharedVideo | null> {
  if (background === null) return null;
  const mime = mimeOf?.(background) ?? null;
  if (stored !== undefined && mime !== null && VIDEO_MIME_TYPES.includes(mime)) {
    const ref = await stored.fileRef(background, mime, ASSET_USES.video).catch(() => null);
    if (ref !== null && ref.size <= (ref.id === undefined ? MAX_ASSET_BYTES : ASSET_CAPS.video)) return { ref, path: background };
    if (ref !== null) return null;
  }
  const video = await readVideo(background).catch((error: unknown) => {
    console.error('[Atlas Online] Could not read an animated map', error);
    return null;
  });
  if (video === null || video.bytes.length > MAX_ASSET_BYTES || !VIDEO_MIME_TYPES.includes(video.mime)) return null;
  return { ref: { hash: await sha256Hex(video.bytes), size: video.bytes.length, mime: video.mime }, path: background };
}
