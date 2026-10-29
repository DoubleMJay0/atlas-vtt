import type { TileRef } from '../../../pixi/mapImage/pyramid';
import type { StoreTrouble } from './storeClient.ts';
import type { AssetStoreClient } from './storeClient.ts';
import type { TakeSlot } from './assetUpload.ts';
import { multipartBody, type FormPart } from './multipartBody.ts';
import type { PyramidPlan } from './pyramidPlan.ts';

/** Where a pyramid's stored tiles are read: this device's tile cache, as they are, never decoded. */
export type TileBlobs = (hash: string, tiles: readonly TileRef[]) => Promise<(ArrayBuffer | null)[]>;

/** One pyramid on its way up: its id, its key in the cache (the image's hash), its plan, and its next batch. */
export interface PyramidJob {
  readonly id: string;
  readonly hash: string;
  readonly plan: PyramidPlan;
  readonly next: number;
}

/**
 * How a run ended: stored, stopped after the overview (`partial`: the rest waits its turn), the cache
 * no longer holds a tile (`changed`), or a trouble of the store; `next` is the batch to send next.
 */
export interface PyramidRun {
  readonly end: 'stored' | 'partial' | 'changed' | StoreTrouble;
  readonly next: number;
}

/** A tile's part in a batch: `<level>/<col>_<row>`, as the store names it. */
const partName = (tile: TileRef): string => `${tile.level}/${tile.col}_${tile.row}`;

/**
 * Uploads a pyramid's batches from `job.next` on, one after another (a page takes the tiles stored to be
 * the first of the plan's order): the manifest with the first, then the tiles read from the cache.
 * With `overviewOnly` it stops once the overview's batches went. `progress` hears the share of pieces
 * the store holds (the manifest and the tiles).
 */
export async function uploadPyramid(job: PyramidJob, deps: { client: Pick<AssetStoreClient, 'putTiles'>; blobs: TileBlobs; slot: TakeSlot; boundary: () => string; progress: (share: number) => void }, overviewOnly: boolean): Promise<PyramidRun> {
  const { batches, manifest } = job.plan;
  for (let next = job.next; next < batches.length; next += 1) {
    const batch = batches[next];
    if (batch === undefined) break;
    if (overviewOnly && !batch.overview) return { end: 'partial', next };
    const blobs = await deps.blobs(job.hash, batch.tiles);
    if (blobs.length !== batch.tiles.length || blobs.some((blob) => blob === null)) return { end: 'changed', next };
    const parts: FormPart[] = batch.tiles.map((tile, index) => ({ name: partName(tile), bytes: new Uint8Array(blobs[index] ?? new ArrayBuffer(0)), type: 'image/webp' }));
    if (batch.manifest) parts.unshift({ name: 'manifest.json', bytes: manifest, type: 'application/json' });
    const { body, contentType } = multipartBody(parts, deps.boundary());
    const release = await deps.slot();
    let put: Awaited<ReturnType<AssetStoreClient['putTiles']>>;
    try {
      put = await deps.client.putTiles(job.id, body, contentType);
    } finally {
      release();
    }
    if (!put.ok) return { end: put.trouble, next };
    if (put.value.stored) return { end: 'stored', next: batches.length };
    deps.progress(put.value.of > 0 ? Math.min(0.99, put.value.pieces / put.value.of) : 0);
  }
  // Every batch went and the store still lacks pieces: sent again from the start, which the store takes once.
  return { end: 'rejected', next: 0 };
}

