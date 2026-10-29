import type { GmMessage } from '../../../../src/app/online/protocol/index.ts';
import type { OfferAnswer, OfferedAsset, PartsSession } from '../../../../src/app/online/gm/assets/assetRoutes.ts';
import { AssetPublisher, type FileStat } from '../../../../src/app/online/gm/assets/AssetPublisher.ts';
import type { StoreResult, StoreTrouble } from '../../../../src/app/online/gm/assets/storeClient.ts';
import { settled } from './settled.ts';
import { pyramidOf } from '../../../../src/app/pixi/mapImage/pyramid';
import { pyramidTiles, type PyramidFacts } from '../../../../src/app/pixi/mapImage/tileBlobs';
import type { MapFocus } from '../../../../src/app/online/gm/assets/pyramidPlan.ts';

/*
 * The asset store as the GM's publisher sees it, for tests: a client that records every request and
 * answers as a test says, requests a test may hold open to watch how many are in flight, a vault of
 * files, a salt, a socket that records what goes to players, and a clock moved by hand.
 */

export const SALT = Uint8Array.from({ length: 32 }, (_, n) => n);

const SIGNING = Symbol.for('atlas-online:hmac');

/** HMACs under way (ids being worked out), watched as `settled` watches hashes, so `idle` waits for them however loaded the machine is. */
const signing: Set<Promise<unknown>> = (() => {
  const shared = globalThis as { [SIGNING]?: Set<Promise<unknown>> };
  const known = shared[SIGNING];
  if (known !== undefined) return known;
  const running = new Set<Promise<unknown>>();
  shared[SIGNING] = running;
  const subtle = globalThis.crypto.subtle;
  const watch = <T>(work: Promise<T>): Promise<T> => {
    running.add(work);
    const done = (): void => void running.delete(work);
    work.then(done, done);
    return work;
  };
  const sign = subtle.sign.bind(subtle);
  const importKey = subtle.importKey.bind(subtle) as (...args: unknown[]) => Promise<CryptoKey>;
  subtle.sign = (...args: Parameters<SubtleCrypto['sign']>): Promise<ArrayBuffer> => watch(sign(...args));
  (subtle as { importKey: unknown }).importKey = (...args: unknown[]): Promise<CryptoKey> => watch(importKey(...args));
  return running;
})();

const ok = <T>(value: T): StoreResult<T> => ({ ok: true, value });
const failed = <T>(trouble: StoreTrouble): StoreResult<T> => ({ ok: false, trouble });

/** A request to the store that went out: what it was, and the way to let it come back. */
export interface StoreCall {
  readonly kind: 'whole' | 'part' | 'start' | 'complete' | 'tiles';
  readonly id: string;
  readonly part?: number;
  readonly bytes?: number;
}

export class FakeStoreClient {
  readonly offers: OfferedAsset[][] = [];
  readonly calls: StoreCall[] = [];
  /** How an offered asset is answered; `need` in one body by default. */
  answer: (asset: OfferedAsset) => OfferAnswer = (asset) => (asset.kind === 'tiles' ? { answer: 'need', upload: 'tiles', partBytes: 8 * 1024 * 1024 } : { answer: 'need', upload: 'single', partBytes: 95 * 1024 * 1024 });
  /** How an offer as a whole is answered: answered by default. */
  offerTrouble: StoreTrouble | null = null;
  /** How an upload request comes back: stored by default. */
  result: (call: StoreCall) => StoreResult<null> = () => ok(null);
  /** The parts of each asset the store holds already (numbered from 1). */
  readonly arrived = new Map<string, number[]>();
  /** While true, uploads wait until `release` lets them come back. */
  hold = false;
  private readonly waiting: (() => void)[] = [];
  inFlight = 0;
  maxInFlight = 0;

  offer(assets: readonly OfferedAsset[]): Promise<StoreResult<Map<string, OfferAnswer>>> {
    this.offers.push([...assets]);
    for (const asset of assets) if (asset.tiles !== undefined) this.pieces.set(asset.id, asset.tiles.count + 1);
    if (this.offerTrouble !== null) return Promise.resolve(failed(this.offerTrouble));
    return Promise.resolve(ok(new Map(assets.map((asset) => [asset.id, this.answer(asset)]))));
  }

  putWhole(id: string, bytes: ArrayBuffer): Promise<StoreResult<null>> {
    return this.call({ kind: 'whole', id, bytes: bytes.byteLength });
  }

  startParts(id: string): Promise<StoreResult<PartsSession>> {
    this.calls.push({ kind: 'start', id });
    return Promise.resolve(ok({ uploadId: `up-${id.slice(0, 6)}`, arrived: new Set(this.arrived.get(id) ?? []) }));
  }

  putPart(id: string, part: number, bytes: ArrayBuffer): Promise<StoreResult<null>> {
    return this.call({ kind: 'part', id, part, bytes: bytes.byteLength });
  }

  /** Batches of tiles that went up: each one's part names, in order. */
  readonly batches: { readonly id: string; readonly names: string[]; readonly bytes: number }[] = [];
  /** How a batch is answered: by default the store counts it and holds the pyramid once every piece is there. */
  tilesResult: ((batch: { readonly id: string; readonly names: string[] }) => StoreResult<{ stored: boolean; pieces: number; of: number }>) | null = null;
  /** The pieces offered for each pyramid (its tiles and the manifest), from its offer. */
  private readonly pieces = new Map<string, number>();
  private readonly held = new Map<string, Set<string>>();

  async putTiles(id: string, body: ArrayBuffer): Promise<StoreResult<{ stored: boolean; pieces: number; of: number }>> {
    const text = new TextDecoder().decode(body);
    const names = [...text.matchAll(/; name="([^"]+)"/g)].map((match) => match[1] ?? '');
    this.batches.push({ id, names, bytes: body.byteLength });
    await this.call({ kind: 'tiles', id, bytes: body.byteLength });
    if (this.tilesResult !== null) return this.tilesResult({ id, names });
    const held = this.held.get(id) ?? new Set<string>();
    for (const name of names) held.add(name);
    this.held.set(id, held);
    const of = this.pieces.get(id) ?? 0;
    return ok({ stored: held.size >= of && held.has('manifest.json'), pieces: held.size, of });
  }

  complete(id: string): Promise<StoreResult<null>> {
    this.calls.push({ kind: 'complete', id });
    return Promise.resolve(ok(null));
  }

  /** Lets the waiting uploads come back, `count` of them (all by default). */
  release(count = Infinity): void {
    for (let n = 0; n < count && this.waiting.length > 0; n += 1) this.waiting.shift()?.();
  }

  get waitingCount(): number {
    return this.waiting.length;
  }

  private async call(call: StoreCall): Promise<StoreResult<null>> {
    this.calls.push(call);
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    if (this.hold) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.inFlight -= 1;
    return this.result(call);
  }
}

export interface PublisherHarness {
  readonly publisher: AssetPublisher;
  readonly client: FakeStoreClient;
  /** What went to players over the socket, live and in order. */
  readonly sent: { readonly body: GmMessage; readonly to: string | undefined; readonly live: boolean }[];
  readonly notices: string[];
  /** The vault's files by path. */
  readonly files: Map<string, Uint8Array<ArrayBuffer>>;
  readonly stats: Map<string, FileStat>;
  /** How many file reads there were, by path. */
  readonly reads: Map<string, number>;
  connection: { players: number; latencyMs: number | null };
  /** The ids of the players connected, who hear progress. */
  players: string[];
  /** Hands players a reference, as a message carrying it that went out to `to` (everyone by default). */
  hand(ref: { readonly id?: string | undefined }, to?: string): void;
  /** The complete pyramids this device's cache holds, by map path. */
  readonly pyramids: Map<string, PyramidFacts>;
  /** The tiles read from the cache for uploads, by batch. */
  readonly tileReads: string[][];
  /** Where players look on the map. */
  focus: MapFocus | null;
  salt: Uint8Array<ArrayBuffer> | null;
  signedOut: number;
  settledCount: number;
  withdrawn: number;
  /** Moves the clock on, running the timers that fall due, and lets work settle. */
  advance(ms: number): Promise<void>;
  /** Lets the work under way settle (hashes, ids, requests that came back). */
  idle(): Promise<void>;
}

/** A publisher over a fake store, vault, socket and clock. */
export function publisherHarness(): PublisherHarness {
  const timers = new Map<number, { readonly at: number; readonly run: () => void }>();
  let now = 0;
  let timerIds = 0;
  const idle = async (): Promise<void> => {
    // Hashes, HMACs and the store's answers each take turns of their own.
    for (let turn = 0; turn < 40; turn += 1) {
      await settled();
      if (signing.size > 0) await Promise.allSettled([...signing]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  const harness: PublisherHarness = {
    client: new FakeStoreClient(),
    sent: [],
    notices: [],
    files: new Map(),
    stats: new Map(),
    reads: new Map(),
    connection: { players: 0, latencyMs: null },
    players: ['p1'],
    hand: (ref, to = '*') => harness.publisher.sent(JSON.stringify({ t: 'scene', scene: { map: ref } }), to),
    pyramids: new Map(),
    tileReads: [],
    focus: null,
    salt: SALT,
    signedOut: 0,
    settledCount: 0,
    withdrawn: 0,
    publisher: undefined as unknown as AssetPublisher,
    advance: async (ms) => {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (due === undefined) break;
        timers.delete(due[0]);
        now = Math.max(now, due[1].at);
        due[1].run();
        await idle();
      }
      now = end;
      await idle();
    },
    idle,
  };
  const publisher = new AssetPublisher({
    client: harness.client,
    salt: { soon: () => Promise.resolve(harness.salt) },
    pyramids: {
      ensure: (path) => Promise.resolve(harness.pyramids.get(path) ?? null),
      blobs: (hash, tiles) => {
        harness.tileReads.push(tiles.map((tile) => `${tile.level}/${tile.col}/${tile.row}`));
        const facts = [...harness.pyramids.values()].find((candidate) => candidate.hash === hash);
        return Promise.resolve(tiles.map((tile) => {
          const stored = facts?.tiles.find((candidate) => candidate.level === tile.level && candidate.col === tile.col && candidate.row === tile.row);
          return stored === undefined ? null : new Uint8Array(stored.bytes).fill(7).buffer;
        }));
      },
      focus: () => harness.focus,
    },
    timers: {
      now: () => now,
      setTimer: (run, ms) => {
        timerIds += 1;
        timers.set(timerIds, { at: now + ms, run });
        return timerIds;
      },
      clearTimer: (timer) => void timers.delete(timer),
    },
    readFile: (path) => {
      harness.reads.set(path, (harness.reads.get(path) ?? 0) + 1);
      return Promise.resolve(harness.files.get(path) ?? null);
    },
    stat: (path) => harness.stats.get(path) ?? (harness.files.has(path) ? { mtime: 1, size: harness.files.get(path)?.length ?? 0 } : null),
    connection: () => harness.connection,
    connected: () => harness.players,
    send: (body, to) => harness.sent.push({ body, to, live: false }),
    sendLive: (body, _key, to) => harness.sent.push({ body, to, live: true }),
    notify: (text) => harness.notices.push(text),
    signedOutByServer: () => void (harness.signedOut += 1),
    settled: () => void (harness.settledCount += 1),
    withdrawn: () => void (harness.withdrawn += 1),
  });
  (harness as { publisher: AssetPublisher }).publisher = publisher;
  return harness;
}

/** Bytes of a given size, each run of them different from the next test's. */
export function bytesOf(size: number, seed = 1): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  for (let n = 0; n < size; n += 1) bytes[n] = (n * 31 + seed * 7) & 0xff;
  return bytes;
}

/** The shares players heard, each id's latest. */
export function sharesHeard(sent: PublisherHarness['sent']): Map<string, number> {
  const shares = new Map<string, number>();
  for (const { body } of sent) if (body.t === 'asset-progress') for (const [id, share] of Object.entries(body.shares)) shares.set(id, share);
  return shares;
}

/** A complete pyramid of a `width` × `height` image of this hash, every tile `tileBytes` long. */
export function pyramidFacts(hash: string, width: number, height: number, tileBytes = 1000, decodedScale = 1): PyramidFacts {
  return { hash, width, height, spec: 2, decodedScale, tiles: pyramidTiles(pyramidOf(width, height, decodedScale)).map((ref) => ({ ...ref, bytes: tileBytes })) };
}
