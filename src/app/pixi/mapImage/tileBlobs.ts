import { pyramidOf, tileKey, type Pyramid, type TileRef } from './pyramid';
import type { PyramidManifest, TileStore } from './tileStore';

/** A tile and its stored WebP size in bytes. */
export interface StoredTileSize extends TileRef {
  bytes: number;
}

/** Which tiles a `tile-blobs` request names: a list, or every tile of a level. */
export type TileSelection = TileRef[] | { level: number };

/** Every tile of a pyramid, in its order: level by level, row by row. */
export function pyramidTiles(pyramid: Pyramid): TileRef[] {
  const refs: TileRef[] = [];
  for (const level of pyramid.levels) {
    for (let row = 0; row < level.rows; row++) for (let col = 0; col < level.cols; col++) refs.push({ level: level.index, col, row });
  }
  return refs;
}

/** The pyramid a stored manifest names. */
export const manifestPyramid = (manifest: Pick<PyramidManifest, 'width' | 'height' | 'decodedScale'>): Pyramid => pyramidOf(manifest.width, manifest.height, manifest.decodedScale);

/** The tiles a selection names, checked against the pyramid; throws for one outside it. */
export function selectedTiles(pyramid: Pyramid, selection: TileSelection): TileRef[] {
  if (Array.isArray(selection)) return selection;
  const level = pyramid.levels[selection.level];
  if (!level) throw new RangeError(`Level ${selection.level} is outside the pyramid`);
  return pyramidTiles(pyramid).filter((ref) => ref.level === level.index);
}

/** The stored bytes of the tiles a selection names, as they are (WebP), in its order; null for one the cache misses. */
export async function readTileBlobs(store: TileStore, hash: string, selection: TileSelection): Promise<(ArrayBuffer | null)[]> {
  const manifest = await store.readManifest(hash);
  if (!manifest) return Array.isArray(selection) ? selection.map(() => null) : [];
  const refs = selectedTiles(manifestPyramid(manifest), selection);
  return Promise.all(refs.map(async (ref) => (await store.getTile(hash, ref))?.arrayBuffer() ?? null));
}

/**
 * A level of a cached pyramid whose every tile is stored: the size and decoded scale of the pyramid
 * it belongs to (its manifest's), the level, and each of its tiles' stored bytes in the pyramid's order.
 */
export interface StoredLevel {
  width: number;
  height: number;
  decodedScale: number;
  level: number;
  tiles: StoredTileSize[];
}

/**
 * The level of a pyramid once the cache holds all its tiles, read without decoding; null while it
 * holds none of the pyramid or misses a tile of the level. Throws for a level outside the pyramid.
 */
export async function readStoredLevel(store: TileStore, hash: string, level: number): Promise<StoredLevel | null> {
  const manifest = await store.readManifest(hash);
  if (!manifest) return null;
  const refs = selectedTiles(manifestPyramid(manifest), { level });
  const held = await store.existingTiles(hash);
  if (refs.some((ref) => !held.has(tileKey(ref)))) return null;
  const tiles: StoredTileSize[] = [];
  for (const ref of refs) {
    const blob = await store.getTile(hash, ref);
    if (!blob) return null;
    tiles.push({ ...ref, bytes: blob.size });
  }
  return { width: manifest.width, height: manifest.height, decodedScale: manifest.decodedScale, level, tiles };
}
