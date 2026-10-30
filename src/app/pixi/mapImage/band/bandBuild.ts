import type { BandDecoder } from '../../../imageProcessing/band/bandTypes';
import type { BuildDeps, BuildOutcome } from '../pyramidBuilder';
import { TILE_BATCH } from '../pyramidBuilder';
import { tileKey, tileSourceRect, type Pyramid, type TileRef } from '../pyramid';
import type { StoredTile } from '../tileStore';
import { BandPyramid, type LevelBand } from './bandPyramid';

/**
 * Writes a map's pyramid into the tile cache from an image the browser cannot decode whole
 * (`DECODED_MAX_PIXELS` or more): the band decoder reads it in rows, `BandPyramid` halves them into
 * every level and hands out each row of tiles as it completes, and the tiles are encoded and written
 * at once, so no level ever exists whole. Two passes: first the image at an eighth (a JPEG's DC
 * terms, a PNG's block means), which gives the overview levels in seconds so the map shows, then
 * every pixel for the three finest levels. A build stops between bands, keeps what it wrote, and a
 * later build of the same map skips the tiles it finds. Tiles a request asks for before the build
 * reaches them are waited for (`whenStored`).
 */

/** The level the reduced pass is rows of: an eighth of the image, a pyramid's fourth level. */
const REDUCED_LEVEL = 3;

interface Pass {
  readonly reduce: 1 | 8;
  readonly baseLevel: number;
  readonly lastLevel: number;
}

/** The passes of a pyramid: the reduced one for the levels an eighth of the image gives, then the rest from the full image. */
export function bandPasses(pyramid: Pyramid): Pass[] {
  const last = pyramid.levels.length - 1;
  if (last < REDUCED_LEVEL) return [{ reduce: 1, baseLevel: 0, lastLevel: last }];
  return [{ reduce: 8, baseLevel: REDUCED_LEVEL, lastLevel: last }, { reduce: 1, baseLevel: 0, lastLevel: REDUCED_LEVEL - 1 }];
}

/**
 * Bytes a band build holds at most: each level's rows of one tile row (`BandPyramid`), halved
 * level by level, plus the decoder's working rows; well under the levels a decoded image holds.
 */
export function bandBuildCost(width: number): number {
  return width * 4 * (512 * 2 + 128);
}

class StoppedError extends Error {}

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
}

export class BandBuild {
  private readonly controller = new AbortController();
  private readonly waiters = new Map<string, Waiter[]>();
  private existing = new Set<string>();
  private done = 0;
  private total = 0;
  private ended: Error | null = null;

  constructor(
    private readonly hash: string,
    readonly pyramid: Pyramid,
    private readonly bytes: Uint8Array,
    private readonly decoder: BandDecoder,
    private readonly deps: BuildDeps,
  ) {}

  /** Ends the build before its next band; what was written stays and a later build resumes from it. */
  stop(): void {
    this.controller.abort(new StoppedError('The build was stopped.'));
  }

  /** Resolves once the tile is in the cache; rejects once the build ended without writing it. */
  whenStored(ref: TileRef): Promise<void> {
    const key = tileKey(ref);
    if (this.existing.has(key)) return Promise.resolve();
    if (this.ended) return Promise.reject(this.ended);
    return new Promise((resolve, reject) => {
      const list = this.waiters.get(key) ?? [];
      list.push({ resolve, reject });
      this.waiters.set(key, list);
    });
  }

  async run(): Promise<BuildOutcome> {
    const { store } = this.deps;
    store.pin(this.hash);
    try {
      await store.beginPyramid({ hash: this.hash, width: this.pyramid.width, height: this.pyramid.height, decodedScale: 1 });
      this.existing = await store.existingTiles(this.hash);
      this.total = this.pyramid.levels.reduce((sum, level) => sum + level.cols * level.rows, 0);
      this.done = this.existing.size;
      for (const waiter of [...this.waiters].filter(([key]) => this.existing.has(key))) this.settle(waiter[0]);
      for (const pass of bandPasses(this.pyramid)) {
        if (this.passStored(pass)) continue;
        await this.runPass(pass);
      }
      if (!(await store.markComplete(this.hash))) return this.end('lost');
      this.deps.emit({ type: 'complete', hash: this.hash });
      return this.end('complete');
    } catch (error) {
      if (error instanceof StoppedError) return this.end('stopped');
      if (error instanceof LostError) return this.end('lost');
      this.deps.emit({ type: 'build-failed', hash: this.hash, message: error instanceof Error ? error.message : String(error) });
      return this.end('failed');
    } finally {
      store.unpin(this.hash);
    }
  }

  /** Whether every tile of the pass's levels is stored already, so its decode can be skipped. */
  private passStored(pass: Pass): boolean {
    for (let index = pass.baseLevel; index <= pass.lastLevel; index++) {
      const level = this.pyramid.levels[index]!;
      for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) if (!this.existing.has(tileKey({ level: index, col, row }))) return false;
      }
    }
    return true;
  }

  private async runPass(pass: Pass): Promise<void> {
    const cutter = new BandPyramid(this.pyramid, { baseLevel: pass.baseLevel, lastLevel: pass.lastLevel, onBand: (band) => this.writeBand(band) });
    await this.decoder.decode(this.bytes, { reduce: pass.reduce, signal: this.controller.signal, onBand: (band) => cutter.push(band) });
    await cutter.finish();
  }

  /** Encodes and writes the tiles of one row of a level that the cache misses. */
  private async writeBand(band: LevelBand): Promise<void> {
    const level = this.pyramid.levels[band.level]!;
    const refs: TileRef[] = [];
    for (let col = 0; col < level.cols; col++) {
      const ref = { level: band.level, col, row: band.row };
      if (!this.existing.has(tileKey(ref))) refs.push(ref);
    }
    if (refs.length === 0) return;
    const bitmap = await this.deps.graphics.fromPixels(band.data, band.width, band.rows);
    try {
      let batch: StoredTile[] = [];
      for (const ref of refs) {
        await this.deps.yieldToRequests();
        this.controller.signal.throwIfAborted();
        const rect = tileSourceRect(this.pyramid, ref);
        const bytes = await this.deps.graphics.encodeTile(bitmap, { ...rect, y: rect.y - band.y });
        batch.push({ ref, bytes });
        if (batch.length >= TILE_BATCH) {
          await this.write(batch);
          batch = [];
        }
      }
      await this.write(batch);
    } finally {
      bitmap.close();
    }
  }

  private async write(batch: StoredTile[]): Promise<void> {
    if (batch.length === 0) return;
    if (!(await this.deps.store.writeTiles(this.hash, batch))) throw new LostError();
    for (const { ref } of batch) {
      this.existing.add(tileKey(ref));
      this.settle(tileKey(ref));
    }
    this.done += batch.length;
    this.deps.emit({ type: 'progress', hash: this.hash, done: this.done, total: this.total });
  }

  private settle(key: string): void {
    const list = this.waiters.get(key);
    if (!list) return;
    this.waiters.delete(key);
    for (const waiter of list) waiter.resolve();
  }

  private end(outcome: BuildOutcome): BuildOutcome {
    this.ended = new Error(`The map's tiles were not all written: the build ${outcome === 'complete' ? 'ended' : outcome}.`);
    for (const list of this.waiters.values()) for (const waiter of list) waiter.reject(this.ended);
    this.waiters.clear();
    return outcome;
  }
}

/** The pyramid left the cache meanwhile: its storage was wiped. */
class LostError extends Error {}
