import { ASSET_CAPS, type AssetRef } from '../../protocol/index.ts';
import { t, type MessageKey } from '../../../i18n';
import type { Timers } from '../companionTimers.ts';
import { AssetIds } from './assetIds.ts';
import { FileHashes, type FileStat } from './fileHashes.ts';
import { AssetProgress, type ProgressPorts } from './assetProgress.ts';
import { AssetRefs, type PyramidSource, type Registration } from './assetRefs.ts';
import type { JobEnd } from './assetJob.ts';
import type { OfferRefusal } from './assetRoutes.ts';
import type { AssetSalt } from './assetSalt.ts';
import type { UploadClient } from './assetUpload.ts';
import { ASSET_RANKS } from './assetUses.ts';
import type { AssetStoreClient } from './storeClient.ts';
import { UploadQueue, type QueueEntry } from './uploadQueue.ts';
import { UploadRunner } from './uploadRunner.ts';

/** How long new assets gather before they are offered, so a scene's go in one request. */
export const OFFER_DELAY_MS = 200;
/** The most assets one offer names. */
export const MAX_OFFER = 2000;

export type { FileStat };

export interface AssetPublisherPorts extends Pick<ProgressPorts, 'sendLive' | 'send' | 'connected'> {
  readonly client: UploadClient & Pick<AssetStoreClient, 'offer' | 'putTiles'>;
  /** This device's map pyramids; without them maps go as images. */
  readonly pyramids?: PyramidSource | undefined;
  readonly salt: Pick<AssetSalt, 'soon'>;
  readonly timers: Timers;
  /** A vault file's bytes as they are, or null where it cannot be read. */
  readFile(path: string): Promise<Uint8Array<ArrayBuffer> | null>;
  stat(path: string): FileStat | null;
  /** The players connected now, and the time the socket's last keep-alive took. */
  connection(): { readonly players: number; readonly latencyMs: number | null };
  /** Tells the GM something (Obsidian's `Notice`). */
  notify(text: string): void;
  /** The relay refused the account's token. */
  signedOutByServer(): void;
  /** Nothing is on its way any more: what the store holds may have changed. */
  settled?(): void;
  /** Assets players were handed can no longer be stored: what names them hands them again, without them. */
  withdrawn?(): void;
}

/**
 * Why the queue stands still: the account is out of room (what the store took already still goes up),
 * may not store, is signed out, or signs out now.
 */
type Halt = 'quota' | 'restricted' | 'forbidden' | 'signed-out';

const REFUSAL_TEXTS: Partial<Record<OfferRefusal | 'failed', MessageKey>> = { quota: 'online.assetsQuota', restricted: 'online.assetsRestricted', 'too-large': 'online.assetsMapTooLarge', failed: 'online.assetsFailed' };

/**
 * One table's way of keeping assets in the store for players (ASD-40 to ASD-44). Every share hands
 * players references through `storing`: with the asset's id where it can be stored, after which the
 * asset is offered (new ones gather for `OFFER_DELAY_MS`, so a scene's go in one request), uploaded in
 * priority order (`UploadRunner`), retried after 1, 2, 4 … 60 seconds and resumed where it stopped.
 * A full quota or an account that may not store stops the queue and tells the GM once. Each player
 * hears how far the assets they were sent references of have come (`AssetProgress`, fed by `sent`).
 * Nothing goes over the table's socket but that and the references themselves.
 */
export class AssetPublisher {
  private readonly queue = new UploadQueue();
  private readonly progress: AssetProgress;
  private readonly runner: UploadRunner;
  private readonly hashes: FileHashes;
  private ids: AssetIds | null = null;
  private halted: Halt | null = null;
  private readonly told = new Set<string>();
  private offering = false;
  private offerTimer: number | undefined;
  private stopped = false;
  /** Whether the store refused a pyramid for its kind (a relay without them): maps go as images from then on. */
  private noTiles = false;
  /** How players are handed references, and how the scenes open beside the presented one are offered. */
  readonly storing: AssetRefs;

  constructor(private readonly ports: AssetPublisherPorts) {
    this.progress = new AssetProgress(ports);
    this.hashes = new FileHashes((path) => ports.stat(path));
    this.runner = new UploadRunner({
      queue: this.queue,
      timers: ports.timers,
      client: ports.client,
      readFile: (path) => ports.readFile(path),
      blobs: ports.pyramids?.blobs,
      unchanged: (path, hash) => this.hashes.kept(path) === hash,
      connection: () => ports.connection(),
      mayUpload: () => this.halted === null || this.halted === 'quota',
      progress: (entry, share) => this.progress.set(entry.id, Math.min(share, 0.99)),
      ended: (entry, end) => this.ended(entry, end),
      tick: () => (this.queue.toOffer(ports.timers.now()).length > 0 ? void this.offer() : this.runner.pump()),
      settled: () => ports.settled?.(),
    });
    this.storing = new AssetRefs({
      hashes: this.hashes,
      readFile: (path) => ports.readFile(path),
      stat: (path) => ports.stat(path),
      pyramids: ports.pyramids,
      register: (asset) => this.register(asset),
      release: (ref) => this.release(ref),
      tilesRefused: () => this.noTiles,
    });
  }

  /** The relay welcomed the table again: everything not stored is offered again (players hear their shares through `resend`). */
  welcome(): void {
    this.resume();
  }

  /** The GM signed in again: what waits is offered again. */
  signedIn(): void {
    this.resume();
  }

  /** A message went to players (`to`: one, or everyone connected): the ids it names are theirs to hear of. */
  sent(text: string, to: string): void {
    this.progress.sent(text, to);
  }

  playerLeft(player: string): void {
    this.progress.playerLeft(player);
  }

  /** The shares a player holds to that player who joined, or each player's to all. */
  resend(to?: string): void {
    this.progress.resend(to);
  }

  /** The account signs out: nothing more is offered or sent, and what goes up stops before its next request. */
  suspend(): void {
    this.halted = 'signed-out';
    this.runner.abort();
  }

  /** The store was emptied (the GM removed the shared copies): everything is offered and uploaded again. */
  emptied(): void {
    this.queue.reoffer(true);
    for (const entry of this.queue.all()) if (entry.handed && entry.state !== 'failed') this.progress.set(entry.id, 0);
    // Its bytes were let go once stored: handed again, its share restores them.
    this.withdraw([...this.queue.all()].filter((entry) => entry.state === 'failed'));
    this.halted = null;
    this.offerSoon();
  }

  stop(): void {
    this.stopped = true;
    this.progress.stop();
    this.runner.stop();
    if (this.offerTimer !== undefined) this.ports.timers.clearTimer(this.offerTimer);
    this.offerTimer = undefined;
  }

  /** Notes an asset and gives its id, or undefined where players are to fetch it from the GM. */
  private async register({ key, hash, size, mime, use, source, handed }: Registration): Promise<string | undefined> {
    if (this.stopped || size <= 0 || size > ASSET_CAPS[use.kind]) return undefined;
    // The round trip before uploads begin is the resting one they are measured against.
    this.runner.limit();
    const salt = await this.ports.salt.soon();
    if (salt === null || this.stopped) return undefined;
    if (this.ids === null || !this.ids.isOf(salt)) this.ids = new AssetIds(salt);
    const id = await this.ids.of(key);
    const known = this.queue.get(id);
    if (known?.state === 'refused' || (known?.state === 'failed' && known.source !== null)) return undefined;
    // While the store takes nothing, new assets, and any not stored once nothing goes up, go the old way.
    if (this.halted !== null && (known === undefined || (this.halted !== 'quota' && known.state !== 'stored'))) return undefined;
    const entry = this.queue.note({ id, hash, size, mime, kind: use.kind, rank: use.rank, handed, source });
    // A pyramid whose overview went keeps its other levels behind the art players see.
    if (entry.source !== null && 'plan' in entry.source && entry.source.plan.batches[entry.next]?.overview === false) entry.rank = Math.max(entry.rank, ASSET_RANKS.mapLevels);
    if (entry.handed) this.progress.set(id, entry.state === 'stored' ? 1 : this.progress.share(id) ?? 0);
    if (entry.state === 'new') this.offerSoon();
    else this.runner.pump();
    return id;
  }

  /** A reference players hold no more (an explored memory a newer one replaced): it is not uploaded if it has not gone yet, and named no more. */
  private release(ref: AssetRef): void {
    const entry = this.queue.get(ref.id);
    if (entry !== undefined && entry.state !== 'stored' && entry.state !== 'uploading') this.queue.forget(ref.id);
    this.progress.delete(ref.id);
  }

  private resume(): void {
    this.halted = null;
    this.queue.reoffer(false);
    this.runner.resetLatency();
    this.offerSoon();
  }

  private offerSoon(): void {
    if (this.stopped || this.offerTimer !== undefined) return;
    this.offerTimer = this.ports.timers.setTimer(() => {
      this.offerTimer = undefined;
      void this.offer();
    }, OFFER_DELAY_MS);
  }

  private async offer(): Promise<void> {
    if (this.offering || this.halted !== null || this.stopped) return this.runner.pump();
    const batch = this.queue.toOffer(this.ports.timers.now()).slice(0, MAX_OFFER);
    if (batch.length === 0) return this.runner.pump();
    this.offering = true;
    for (const entry of batch) entry.state = 'offered';
    const answer = await this.ports.client.offer(batch.map(({ id, kind, size, source }) => ({ id, kind, size, ...(source !== null && 'plan' in source && { tiles: { levels: source.plan.levels, count: source.plan.count } }) })));
    this.offering = false;
    if (this.stopped) return;
    const now = this.ports.timers.now();
    if (!answer.ok) {
      for (const entry of batch) if (entry.state === 'offered') this.queue.failed(entry, now, 'new');
      if (answer.trouble === 'signed-out' || answer.trouble === 'forbidden') this.halt(answer.trouble);
      return this.runner.pump();
    }
    const withdrawn: QueueEntry[] = [];
    for (const entry of batch) {
      const outcome = this.queue.answered(entry, answer.value.get(entry.id), now);
      if (outcome === 'have') this.stored(entry);
      else if (outcome === 'quota' || outcome === 'restricted') this.halt(outcome);
      else if (outcome === 'too-large' && entry.rank === ASSET_RANKS.map) this.tell('too-large');
      else if (outcome === 'kind' && entry.kind === 'tiles') this.noTiles = true;
      if (outcome !== null && outcome !== 'have' && outcome !== 'need') withdrawn.push(entry);
    }
    this.withdraw(withdrawn);
    if (this.queue.toOffer(now).length > 0) this.offerSoon();
    this.runner.pump();
  }

  private stored(entry: QueueEntry): void {
    this.queue.stored(entry);
    if (entry.handed) this.progress.set(entry.id, 1);
  }

  /**
   * The store takes no more: out of room, what it accepted still goes up; otherwise nothing will, so
   * every asset players were handed that is not stored is taken from them.
   */
  private halt(reason: Halt): void {
    this.halted = reason;
    if (reason === 'signed-out') this.ports.signedOutByServer();
    if (reason === 'quota' || reason === 'restricted') this.tell(reason);
    if (reason !== 'quota') this.withdraw([...this.queue.all()].filter((entry) => entry.state !== 'stored'));
  }

  /** Tells the GM once per table. */
  private tell(reason: OfferRefusal | 'failed'): void {
    const key = REFUSAL_TEXTS[reason];
    if (key === undefined || this.told.has(reason)) return;
    this.told.add(reason);
    this.ports.notify(t(key));
  }

  /** Players were handed ids the store will not keep: their shares are named no more, and what handed them hands them again. */
  private withdraw(entries: readonly QueueEntry[]): void {
    const handed = entries.filter((entry) => entry.handed);
    for (const entry of handed) this.progress.delete(entry.id);
    if (handed.length > 0) this.ports.withdrawn?.();
  }

  private ended(entry: QueueEntry, end: JobEnd): void {
    const now = this.ports.timers.now();
    if (end === 'stored') return this.stored(entry);
    if (end === 'partial') {
      entry.state = 'queued';
      entry.rank = Math.max(entry.rank, ASSET_RANKS.mapLevels);
      return;
    }
    if (end === 'signed-out' || end === 'forbidden') {
      entry.state = 'queued';
      return this.halt(end);
    }
    // The upload's row is gone (the store was emptied, or kept it too long): offered again, a pyramid from its manifest.
    if (end === 'missing') {
      entry.next = 0;
      return this.queue.failed(entry, now, 'new');
    }
    if (end === 'retry' || end === 'stopped') return this.queue.failed(entry, now, 'queued');
    // The bytes are not those offered (the file changed), or the store refused them twice.
    entry.rejected += 1;
    if (end === 'rejected' && entry.rejected < 2) return this.queue.failed(entry, now, 'queued');
    // A pyramid the cache lost is built again when what names it hands it again.
    if (end === 'changed' && entry.kind === 'tiles') this.queue.forget(entry.id);
    else entry.state = 'failed';
    this.tell('failed');
    this.withdraw([entry]);
  }
}
