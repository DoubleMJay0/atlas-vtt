import type { GmMessage } from '../../../../src/app/online/protocol/index.ts';
import type { OfferAnswer, OfferedAsset, PartsSession } from '../../../../src/app/online/gm/assets/assetRoutes.ts';
import { AssetPublisher, type FileStat } from '../../../../src/app/online/gm/assets/AssetPublisher.ts';
import type { StoreResult, StoreTrouble } from '../../../../src/app/online/gm/assets/storeClient.ts';
import { settled } from './settled.ts';

/*
 * The asset store as the GM's publisher sees it, for tests: a client that records every request and
 * answers as a test says, requests a test may hold open to watch how many are in flight, a vault of
 * files, a salt, a socket that records what goes to players, and a clock moved by hand.
 */

export const SALT = Uint8Array.from({ length: 32 }, (_, n) => n);

const ok = <T>(value: T): StoreResult<T> => ({ ok: true, value });
const failed = <T>(trouble: StoreTrouble): StoreResult<T> => ({ ok: false, trouble });

/** A request to the store that went out: what it was, and the way to let it come back. */
export interface StoreCall {
  readonly kind: 'whole' | 'part' | 'start' | 'complete';
  readonly id: string;
  readonly part?: number;
  readonly bytes?: number;
}

export class FakeStoreClient {
  readonly offers: OfferedAsset[][] = [];
  readonly calls: StoreCall[] = [];
  /** How an offered asset is answered; `need` in one body by default. */
  answer: (asset: OfferedAsset) => OfferAnswer = () => ({ answer: 'need', upload: 'single', partBytes: 95 * 1024 * 1024 });
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
