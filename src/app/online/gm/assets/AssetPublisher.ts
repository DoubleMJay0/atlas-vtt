import { ASSET_CAPS } from '../../protocol/index.ts';
import { t, type MessageKey } from '../../../i18n';
import type { Timers } from '../companionTimers.ts';
import { AssetIds } from './assetIds.ts';
import { FileHashes, type FileStat } from './fileHashes.ts';
import { AssetProgress, type ProgressPorts } from './assetProgress.ts';
import type { OfferRefusal } from './assetRoutes.ts';
import type { AssetSalt } from './assetSalt.ts';
import { AssetRefs, type PyramidSource, type Registration } from './assetRefs.ts';
import { runJob, type JobEnd } from './assetJob.ts';
import type { UploadClient } from './assetUpload.ts';
import { ASSET_RANKS } from './assetUses.ts';
import type { AssetStoreClient } from './storeClient.ts';
import { inFlight, RestingLatency, Slots } from './uploadPace.ts';
import { UploadQueue, type QueueEntry } from './uploadQueue.ts';

/** How long new assets gather before they are offered, so a scene's go in one request. */
export const OFFER_DELAY_MS = 200;
/** How often the queue looks again while anything is on its way: players come and go, the round trip changes. */
export const PUMP_MS = 1_000;
/** The most assets one offer names. */
export const MAX_OFFER = 2000;

export type { FileStat };

export interface AssetPublisherPorts extends Pick<ProgressPorts, 'sendLive' | 'send'> {
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
  /** Assets players were handed with an id can no longer be stored: what names them may hand them again without one. */
  withdrawn?(): void;
}

/** Why the queue stands still: the account is out of room, may not store, or is signed out. */
type Halt = 'quota' | 'restricted' | 'forbidden' | 'signed-out';

const REFUSAL_TEXTS: Partial<Record<OfferRefusal | 'failed', MessageKey>> = { quota: 'online.assetsQuota', restricted: 'online.assetsRestricted', 'too-large': 'online.assetsMapTooLarge', failed: 'online.assetsFailed' };

/**
 * One table's way of keeping assets in the store for players (ASD-40 to ASD-44). Every share hands
 * players references through `storing`: with the asset's id where it can be stored, after which the
 * asset is offered (new ones gather for `OFFER_DELAY_MS`, so a scene's go in one request), uploaded in
 * priority order, as many requests at once as the connection allows (`inFlight`), retried after 1, 2,
 * 4 … 60 seconds and resumed where it stopped. A full quota or an account that may not store stops the
 * queue and tells the GM once. Players hear how far each asset handed to them has come
 * (`AssetProgress`). Nothing goes over the table's socket but that and the references themselves.
 */
export class AssetPublisher {
  private readonly queue = new UploadQueue();
  private readonly progress: AssetProgress;
  private readonly latency = new RestingLatency();
  private readonly slots: Slots;
  private readonly hashes: FileHashes;
  private ids: AssetIds | null = null;
  private halted: Halt | null = null;
  private readonly told = new Set<string>();
  private uploading = 0;
  private offering = false;
  private offerTimer: number | undefined;
  private pumpTimer: number | undefined;
  private stopped = false;
  /** Whether the store refused a pyramid for its kind (a relay without them): maps go as images from then on. */
  private noTiles = false;
  /** How players are handed references, and how the scenes open beside the presented one are offered. */
  readonly storing: AssetRefs;

  constructor(private readonly ports: AssetPublisherPorts) {
    this.progress = new AssetProgress(ports);
    this.slots = new Slots(() => this.limit());
    this.hashes = new FileHashes((path) => ports.stat(path));
    this.storing = new AssetRefs({
      hashes: this.hashes,
      readFile: (path) => ports.readFile(path),
      stat: (path) => ports.stat(path),
      pyramids: ports.pyramids,
      register: (asset) => this.register(asset),
      tilesRefused: () => this.noTiles,
    });
  }

  /** The relay welcomed the table again: everything not stored is offered again (players hear every share through `resend`). */
  welcome(): void {
    this.resume();
  }

  /** The GM signed in again: what waits is offered again. */
  signedIn(): void {
    this.resume();
  }

  /** Every share to one player who joined, or to all. */
  resend(to?: string): void {
    this.progress.resend(to);
  }

  /** The store was emptied (the GM removed the shared copies): everything is offered and uploaded again. */
  emptied(): void {
    this.queue.reoffer(true);
    for (const entry of this.queue.all()) if (entry.handed) this.progress.set(entry.id, 0);
    this.halted = null;
    this.offerSoon();
  }

  stop(): void {
    this.stopped = true;
    this.progress.stop();
    for (const timer of [this.offerTimer, this.pumpTimer]) if (timer !== undefined) this.ports.timers.clearTimer(timer);
    this.offerTimer = undefined;
    this.pumpTimer = undefined;
  }

  /** Notes an asset and gives its id, or undefined where players are to fetch it from the GM. */
  private async register({ key, hash, size, mime, use, source, handed }: Registration): Promise<string | undefined> {
    if (this.stopped || size <= 0 || size > ASSET_CAPS[use.kind]) return undefined;
    // The round trip before uploads begin is the resting one they are measured against.
    this.limit();
    const salt = await this.ports.salt.soon();
    if (salt === null || this.stopped) return undefined;
    if (this.ids === null || !this.ids.isOf(salt)) this.ids = new AssetIds(salt);
    const id = await this.ids.of(key);
    const known = this.queue.get(id);
    if (known?.state === 'refused' || known?.state === 'failed') return undefined;
    // While the store takes nothing, new assets go the old way.
    if (known === undefined && this.halted !== null) return undefined;
    const entry = this.queue.note({ id, hash, size, mime, kind: use.kind, rank: use.rank, handed, source });
    // A pyramid whose overview went keeps its other levels behind the art players see.
    if (entry.source !== null && 'plan' in entry.source && entry.source.plan.batches[entry.next]?.overview === false) entry.rank = Math.max(entry.rank, ASSET_RANKS.mapLevels);
    if (entry.handed) this.progress.set(id, entry.state === 'stored' ? 1 : this.progress.share(id) ?? 0);
    if (entry.state === 'new') this.offerSoon();
    else this.pump();
    return id;
  }

  private resume(): void {
    this.halted = null;
    this.queue.reoffer(false);
    this.latency.reset();
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
    if (this.offering || this.halted !== null || this.stopped) return;
    const batch = this.queue.toOffer(this.ports.timers.now()).slice(0, MAX_OFFER);
    if (batch.length === 0) return this.pump();
    this.offering = true;
    for (const entry of batch) entry.state = 'offered';
    const answer = await this.ports.client.offer(batch.map(({ id, kind, size, source }) => ({ id, kind, size, ...(source !== null && 'plan' in source && { tiles: { levels: source.plan.levels, count: source.plan.count } }) })));
    this.offering = false;
    if (this.stopped) return;
    const now = this.ports.timers.now();
    if (!answer.ok) {
      for (const entry of batch) if (entry.state === 'offered') this.queue.failed(entry, now, 'new');
      if (answer.trouble === 'signed-out' || answer.trouble === 'forbidden') this.halt(answer.trouble);
      return this.pump();
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
    this.pump();
  }

  private stored(entry: QueueEntry): void {
    this.queue.stored(entry);
    if (entry.handed) this.progress.set(entry.id, 1);
  }

  private halt(reason: Halt): void {
    this.halted = reason;
    if (reason === 'signed-out') this.ports.signedOutByServer();
    if (reason === 'quota' || reason === 'restricted') this.tell(reason);
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

  private limit(): number {
    const { players, latencyMs } = this.ports.connection();
    this.latency.sample(latencyMs, this.ports.timers.now());
    return inFlight(players, latencyMs, this.latency.value());
  }

  /** Starts what may go now and looks again while anything is on its way. */
  private pump(): void {
    if (this.stopped) return;
    this.slots.drain();
    const now = this.ports.timers.now();
    while (this.halted === null && this.uploading < this.limit()) {
      const next = this.queue.next(now);
      if (next === undefined) break;
      void this.upload(next);
    }
    // While the store takes nothing, only a reconnect, a sign-in or the copies removed start the queue again.
    if (this.pumpTimer === undefined && this.halted === null && (this.queue.busy || this.uploading > 0)) {
      this.pumpTimer = this.ports.timers.setTimer(() => {
        this.pumpTimer = undefined;
        if (this.queue.toOffer(this.ports.timers.now()).length > 0) void this.offer();
        else this.pump();
      }, PUMP_MS);
    }
  }

  private async upload(entry: QueueEntry): Promise<void> {
    entry.state = 'uploading';
    this.uploading += 1;
    let end: JobEnd;
    try {
      end = await runJob(entry, {
        client: this.ports.client,
        readFile: (path) => this.ports.readFile(path),
        blobs: this.ports.pyramids?.blobs,
        slot: () => this.slots.take(),
        progress: (share) => {
          if (entry.handed) this.progress.set(entry.id, Math.min(share, 0.99));
        },
      });
    } catch {
      end = 'retry';
    }
    this.uploading -= 1;
    if (this.stopped) return;
    this.ended(entry, end);
    this.pump();
    if (!this.queue.busy && this.uploading === 0) this.ports.settled?.();
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
    // The upload's row is gone (the store was emptied, or kept it too long): offered again.
    if (end === 'missing') {
      entry.next = 0;
      return this.queue.failed(entry, now, 'new');
    }
    if (end === 'retry') return this.queue.failed(entry, now, 'queued');
    // The bytes are not those offered (the file changed), or the store refused them twice.
    entry.rejected += 1;
    if (end === 'rejected' && entry.rejected < 2) return this.queue.failed(entry, now, 'queued');
    // A pyramid the cache lost is built again when what names it hands it again.
    if (end === 'changed' && entry.kind === 'tiles') {
      this.queue.forget(entry.id);
      return this.withdraw([entry]);
    }
    entry.state = 'failed';
    this.tell('failed');
    this.withdraw([entry]);
  }
}
