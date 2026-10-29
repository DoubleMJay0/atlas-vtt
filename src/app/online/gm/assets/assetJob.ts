import { randomHex } from '../../../utils/randomHex';
import { uploadAsset, type TakeSlot, type UploadClient, type UploadEnd } from './assetUpload.ts';
import { uploadPyramid, type TileBlobs } from './pyramidUpload.ts';
import type { AssetStoreClient } from './storeClient.ts';
import type { QueueEntry } from './uploadQueue.ts';

export interface JobDeps {
  readonly client: UploadClient & Pick<AssetStoreClient, 'putTiles'>;
  readFile(path: string): Promise<Uint8Array<ArrayBuffer> | null>;
  /** This device's stored tiles; without them no pyramid goes up. */
  readonly blobs?: TileBlobs | undefined;
  readonly slot: TakeSlot;
  /** Stops the job before its next request (the table ended, the account signs out). */
  readonly signal: AbortSignal;
  /** Whether a vault file still is what it was hashed as (its time and size did not change since). */
  readonly unchanged: (path: string, hash: string) => boolean;
  /** The share of the asset stored so far. */
  readonly progress: (share: number) => void;
}

/** How a job ended; `partial`: a pyramid's overview went, its other levels wait their turn. */
export type JobEnd = UploadEnd | 'partial';

/**
 * Runs one asset's upload as the store asked for it: a pyramid batch by batch from where it stopped
 * (`entry.next` follows), with only its overview while it has not gone yet, any other asset from its
 * bytes (kept, or read again from the vault).
 */
export async function runJob(entry: QueueEntry, deps: JobDeps): Promise<JobEnd> {
  const { upload, source } = entry;
  if (upload === null || source === null) return 'changed';
  if ('plan' in source) {
    if (deps.blobs === undefined || upload.upload !== 'tiles') return 'changed';
    const overviewOnly = source.plan.batches[entry.next]?.overview === true;
    const run = await uploadPyramid({ id: entry.id, hash: entry.hash, plan: source.plan, next: entry.next }, { client: deps.client, blobs: deps.blobs, slot: deps.slot, boundary: () => randomHex(16), progress: deps.progress, signal: deps.signal }, overviewOnly);
    entry.next = run.next;
    return run.end;
  }
  if (upload.upload === 'tiles') return 'changed';
  const bytes = 'bytes' in source ? source.bytes : await deps.readFile(source.path).catch(() => null);
  if (bytes === null) return 'changed';
  // Bytes kept since they were hashed, or a file unchanged since, are not hashed again whole.
  const trusted = 'bytes' in source || deps.unchanged(source.path, entry.hash);
  return uploadAsset({ id: entry.id, hash: entry.hash, mime: entry.mime, upload: upload.upload, partBytes: upload.partBytes }, bytes, deps.client, deps.slot, deps.progress, { signal: deps.signal, trusted });
}
