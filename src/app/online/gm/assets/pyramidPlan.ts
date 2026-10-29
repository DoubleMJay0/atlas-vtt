import { factsPyramid, type PyramidFacts, type StoredTileSize } from '../../../pixi/mapImage/tileBlobs';
import { tileWorldRect, type Pyramid } from '../../../pixi/mapImage/pyramid';

/** The most a batch of tiles carries: below the store's 8 MiB body, with room for the form's headers. */
export const BATCH_BYTES = 7.5 * 1024 * 1024;
/** The most tiles one batch carries. */
export const BATCH_TILES = 32;

/** Where players look on the map, as shares of its width and height (0 to 1). */
export interface MapFocus {
  readonly x: number;
  readonly y: number;
}

export const MAP_CENTRE: MapFocus = { x: 0.5, y: 0.5 };

/** One request of a pyramid's upload: its tiles, and whether it carries the manifest. */
export interface TileBatch {
  readonly tiles: readonly StoredTileSize[];
  readonly manifest: boolean;
  /** Whether it belongs to the overview level, which goes before anything else of the map. */
  readonly overview: boolean;
}

/** How a pyramid goes into the store: its manifest, its pieces and bytes, and its batches in order. */
export interface PyramidPlan {
  /** `manifest.json`: width, height, spec, levels and tile count, which a page reads the pyramid by. */
  readonly manifest: Uint8Array<ArrayBuffer>;
  readonly levels: number;
  /** Its tiles, all levels together. */
  readonly count: number;
  /** Its tiles' stored bytes and the manifest's: what the store keeps of it. */
  readonly bytes: number;
  readonly batches: readonly TileBatch[];
}

/** The order levels go up in (ASD-41): the overview, then the others from coarse to fine, as a page expects them. */
export function levelOrder(pyramid: Pyramid): number[] {
  const rest = pyramid.levels.map((level) => level.index).filter((index) => index !== pyramid.overview).reverse();
  return [pyramid.overview, ...rest];
}

/** A tile's distance from the focus, in shares of the map. */
function distance(pyramid: Pyramid, tile: StoredTileSize, focus: MapFocus): number {
  const rect = tileWorldRect(pyramid, tile);
  return Math.hypot((rect.x + rect.width / 2) / pyramid.width - focus.x, (rect.y + rect.height / 2) / pyramid.height - focus.y);
}

/**
 * The upload of a complete pyramid: the manifest in the first batch, then the overview level, then the
 * levels from coarse to fine, within each level the tiles nearest `focus` first, in batches of at most
 * `BATCH_TILES` tiles and `BATCH_BYTES` bytes; the overview's batches end with it.
 */
export function planPyramid(facts: PyramidFacts, focus: MapFocus = MAP_CENTRE): PyramidPlan {
  const pyramid = factsPyramid(facts);
  const manifest = new TextEncoder().encode(JSON.stringify({ width: facts.width, height: facts.height, spec: facts.spec, levels: pyramid.levels.length, count: facts.tiles.length })).slice();
  const batches: TileBatch[] = [];
  let current: StoredTileSize[] = [];
  let size = manifest.length;
  let overview = true;
  const close = (): void => {
    if (current.length === 0 && batches.length > 0) return;
    batches.push({ tiles: current, manifest: batches.length === 0, overview });
    current = [];
    size = 0;
  };
  for (const index of levelOrder(pyramid)) {
    const tiles = facts.tiles.filter((tile) => tile.level === index).map((tile) => ({ tile, away: distance(pyramid, tile, focus) }));
    tiles.sort((a, b) => a.away - b.away);
    for (const { tile } of tiles) {
      if (current.length > 0 && (current.length >= BATCH_TILES || size + tile.bytes > BATCH_BYTES)) close();
      current.push(tile);
      size += tile.bytes;
    }
    if (overview) {
      close();
      overview = false;
    }
  }
  if (current.length > 0) close();
  const bytes = manifest.length + facts.tiles.reduce((sum, tile) => sum + tile.bytes, 0);
  return { manifest, levels: pyramid.levels.length, count: facts.tiles.length, bytes, batches };
}
