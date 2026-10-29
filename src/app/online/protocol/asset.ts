import { isRecord } from './shape.ts';

/** A SHA-256 in lowercase hex: how every asset is named. */
export const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** Bytes of an asset per chunk: their base64 is exactly 256 KiB. */
export const ASSET_CHUNK_BYTES = 192 * 1024;
/** The largest asset the GM serves over the table's socket and a client accepts from it (a reference without an id). */
export const MAX_ASSET_BYTES = 64 * 1024 * 1024;

/**
 * A stored asset's name on the asset host, 64 lowercase hex characters: `HMAC-SHA-256(gmSalt, hash)`,
 * made by the GM's Atlas, unguessable, and the capability to read the object for as long as it lives.
 */
export const ASSET_ID_PATTERN = /^[0-9a-f]{64}$/;
/** The largest object the asset store holds under one id (a tile pyramid as a whole, a video). */
export const MAX_STORED_BYTES = 2 * 1024 ** 3;
/** What one stored asset of each kind may hold at most; the store's offer refuses more. */
export const ASSET_CAPS = {
  image: 95 * 1024 * 1024,
  tiles: MAX_STORED_BYTES,
  video: 500 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  text: 1024 * 1024,
  book: 64 * 1024 * 1024,
} as const;
export type AssetKind = keyof typeof ASSET_CAPS;
export const isAssetKind = (value: unknown): value is AssetKind => typeof value === 'string' && Object.hasOwn(ASSET_CAPS, value);

/** Image types a map or a token's artwork may have. */
export const IMAGE_MIME_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
/** Video types an animated map may have: a page plays it in its poster's place. */
export const VIDEO_MIME_TYPES: readonly string[] = ['video/webm', 'video/mp4'];
/** The type of a text players are sent by hash (a quest's whole text): Markdown in UTF-8. */
export const TEXT_MIME_TYPE = 'text/markdown';

/**
 * An asset as players are sent it. With `id` (a GM of level 9 or later) the page fetches it from the
 * asset host under that name; without one it asks the GM for it by hash over the table's socket.
 */
export interface AssetRef {
  readonly hash: string;
  readonly size: number;
  readonly mime: string;
  readonly id?: string;
}

export const isHash = (value: unknown): value is string => typeof value === 'string' && HASH_PATTERN.test(value);
export const isAssetId = (value: unknown): value is string => typeof value === 'string' && ASSET_ID_PATTERN.test(value);
export const isCount = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

function parseRef(value: unknown, mimes: readonly string[]): AssetRef | null {
  if (!isRecord(value) || !isHash(value.hash)) return null;
  if (value.id !== undefined && !isAssetId(value.id)) return null;
  if (!isCount(value.size, value.id === undefined ? MAX_ASSET_BYTES : MAX_STORED_BYTES)) return null;
  if (typeof value.mime !== 'string' || !mimes.includes(value.mime)) return null;
  return { hash: value.hash, size: value.size, mime: value.mime, ...(value.id === undefined ? {} : { id: value.id }) };
}

/** An image's reference, or null for anything malformed or of a type players are not sent. */
export const parseAsset = (value: unknown): AssetRef | null => parseRef(value, IMAGE_MIME_TYPES);

/** A video's reference (`VIDEO_MIME_TYPES`), or null for anything malformed or of another type. */
export const parseVideoAsset = (value: unknown): AssetRef | null => parseRef(value, VIDEO_MIME_TYPES);

/** A text's reference (`TEXT_MIME_TYPE`), or null for anything malformed or of another type. */
export const parseTextAsset = (value: unknown): AssetRef | null => parseRef(value, [TEXT_MIME_TYPE]);

/** The sides a player may ask an image to be scaled down to. */
export const MIN_MAX_SIDE = 256;
export const MAX_MAX_SIDE = 16384;

export const isMaxSide = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= MIN_MAX_SIDE && value <= MAX_MAX_SIDE;

/**
 * The GM's answer to a request with a longest side for an image larger than that: `variant` is the
 * image `hash` scaled down to fit `maxSide`, sent by its own hash in the chunks that follow, and
 * `width` × `height` the image's own size, at which the page draws the copy.
 */
export interface AssetVariant {
  readonly t: 'asset-variant';
  readonly hash: string;
  readonly maxSide: number;
  readonly variant: AssetRef;
  readonly width: number;
  readonly height: number;
}

/** A side of an image in pixels, as a message may name it. */
export const isSide = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1 << 20;

export function parseAssetVariant(value: Record<string, unknown>): AssetVariant | null {
  const variant = parseAsset(value.variant);
  if (!isHash(value.hash) || !isMaxSide(value.maxSide) || variant === null || !isSide(value.width) || !isSide(value.height)) return null;
  return { t: 'asset-variant', hash: value.hash, maxSide: value.maxSide, variant, width: value.width, height: value.height };
}

/** The most assets one progress message names. */
export const MAX_PROGRESS_ENTRIES = 2000;

/**
 * How far the GM's uploads to the asset store have come, by id: 0 to 1, where 1 means the object
 * can be fetched (a pyramid's share counts its tiles, the overview level first). A GM of level 9
 * sends it paced while anything is on its way, and once more with 1 when it is done, so a page never
 * asks the host for an object before it is there.
 */
export interface AssetProgress {
  readonly t: 'asset-progress';
  readonly shares: Readonly<Record<string, number>>;
}

export function parseAssetProgress(value: Record<string, unknown>): AssetProgress | null {
  if (!isRecord(value.shares)) return null;
  const entries = Object.entries(value.shares);
  if (entries.length > MAX_PROGRESS_ENTRIES) return null;
  const shares: Record<string, number> = {};
  for (const [id, share] of entries) {
    if (!isAssetId(id) || typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 1) return null;
    shares[id] = share;
  }
  return { t: 'asset-progress', shares };
}
