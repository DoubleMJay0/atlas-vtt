import { pyramidOf, TILE_SPEC, type Pyramid, type TileRef } from './pyramid';
import type { TileStore } from './tileStore';

/**
 * A complete pyramid as the cache holds it, for whoever copies it elsewhere: its size, spec and
 * decoded scale (the pyramid they name), and the stored bytes of every tile, read without decoding.
 */
export interface PyramidFacts {
  hash: string;
  width: number;
  height: number;
  spec: number;
  decodedScale: number;
  /** Each tile's stored WebP size in bytes, every level, in the pyramid's order (level, row, column). */
  tiles: StoredTileSize[];
}

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

/** The pyramid a stored complete pyramid's facts name. */
export const factsPyramid = (facts: Pick<PyramidFacts, 'width' | 'height' | 'decodedScale'>): Pyramid => pyramidOf(facts.width, facts.height, facts.decodedScale);

/**
 * The facts of a complete pyramid of this tile spec, or null where the cache holds none (not built,
 * built only in part, evicted, or of another spec) or misses one of its tiles.
 */
export async function readPyramidFacts(store: TileStore, hash: string): Promise<PyramidFacts | null> {
  const manifest = await store.readManifest(hash);
  if (!manifest || !manifest.complete || manifest.spec !== TILE_SPEC) return null;
  const tiles: StoredTileSize[] = [];
  for (const ref of pyramidTiles(factsPyramid(manifest))) {
    const blob = await store.getTile(hash, ref);
    if (!blob) return null;
    tiles.push({ ...ref, bytes: blob.size });
  }
  return { hash, width: manifest.width, height: manifest.height, spec: manifest.spec, decodedScale: manifest.decodedScale, tiles };
}

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
  const refs = selectedTiles(factsPyramid(manifest), selection);
  return Promise.all(refs.map(async (ref) => (await store.getTile(hash, ref))?.arrayBuffer() ?? null));
}
