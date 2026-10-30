// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BandBuild, bandPasses } from '../../../../src/app/pixi/mapImage/band/bandBuild';
import { halveRows } from '../../../../src/app/pixi/mapImage/band/halveRows';
import { MemoryTileBackend } from '../../../../src/app/pixi/mapImage/memoryTileBackend';
import { pyramidOf, tileKey, tileSourceRect, type PixelRect, type Pyramid, type TileRef } from '../../../../src/app/pixi/mapImage/pyramid';
import type { ComposedPart, TileGraphics } from '../../../../src/app/pixi/mapImage/tileGraphics';
import type { TileEvent } from '../../../../src/app/pixi/mapImage/tileProtocol';
import { TileStore } from '../../../../src/app/pixi/mapImage/tileStore';
import { useReadableBlobs } from '../fakeTileGraphics';
import { fakeBandDecoder, reducedImage, wholeImage } from './fakeBandDecoder';

/** A bitmap that keeps its pixels, so a tile's bytes can be checked. */
class PixelBitmap implements ImageBitmap {
  closed = false;
  constructor(readonly width: number, readonly height: number, readonly data: Uint8ClampedArray) {}
  close(): void {
    this.closed = true;
  }
}

const crop = (source: PixelBitmap, rect: PixelRect): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    out.set(source.data.subarray(((rect.y + y) * source.width + rect.x) * 4, ((rect.y + y) * source.width + rect.x + rect.width) * 4), y * rect.width * 4);
  }
  return out;
};

/** Graphics whose "WebP" is the raw RGBA of the rect, so tests read tiles back exactly. */
class PixelGraphics implements TileGraphics {
  decode(blob: Blob): Promise<ImageBitmap> {
    return blob.arrayBuffer().then((buffer) => {
      const view = new DataView(buffer);
      return new PixelBitmap(view.getUint32(0), view.getUint32(4), new Uint8ClampedArray(buffer, 8));
    });
  }
  resize(): Promise<ImageBitmap> {
    throw new Error('not needed');
  }
  crop(source: ImageBitmap, rect: PixelRect): Promise<ImageBitmap> {
    return Promise.resolve(new PixelBitmap(rect.width, rect.height, crop(source as PixelBitmap, rect)));
  }
  fromPixels(data: Uint8ClampedArray, width: number, height: number): Promise<ImageBitmap> {
    return Promise.resolve(new PixelBitmap(width, height, data.slice()));
  }
  encodeTile(source: ImageBitmap, rect: PixelRect): Promise<Blob> {
    const header = new DataView(new ArrayBuffer(8));
    header.setUint32(0, rect.width);
    header.setUint32(4, rect.height);
    return Promise.resolve(new Blob([header, crop(source as PixelBitmap, rect)], { type: 'image/webp' }));
  }
  compose(_width: number, _height: number, _parts: readonly ComposedPart[]): ImageBitmap {
    throw new Error('not needed');
  }
  opaquePixels(): Uint8Array {
    throw new Error('not needed');
  }
  alphaBytes(): Uint8Array {
    throw new Error('not needed');
  }
}

/** Every level as the build should hold it: levels 0 to 2 halved from the whole image, the rest halved from the reduced one. */
function expectedLevels(pyramid: Pyramid, width: number, height: number): Map<number, Uint8ClampedArray> {
  const levels = new Map<number, Uint8ClampedArray>();
  const halve = (from: number, data: Uint8ClampedArray, until: number): void => {
    levels.set(from, data);
    let current = data;
    for (let index = from + 1; index <= until; index++) {
      const finer = pyramid.levels[index - 1]!;
      const level = pyramid.levels[index]!;
      const next = new Uint8ClampedArray(level.width * level.height * 4);
      const stride = finer.width * 4;
      for (let y = 0; y < level.height; y++) {
        const above = current.subarray(2 * y * stride, (2 * y + 1) * stride);
        const below = 2 * y + 1 < finer.height ? current.subarray((2 * y + 1) * stride, (2 * y + 2) * stride) : null;
        halveRows(above, below, finer.width, next.subarray(y * level.width * 4, (y + 1) * level.width * 4));
      }
      levels.set(index, next);
      current = next;
    }
  };
  const [first, second] = bandPasses(pyramid);
  if (second) {
    halve(first!.baseLevel, reducedImage(width, height), first!.lastLevel);
    halve(0, wholeImage(width, height), second.lastLevel);
  } else {
    halve(0, wholeImage(width, height), first!.lastLevel);
  }
  return levels;
}

interface Bench {
  store: TileStore;
  events: TileEvent[];
  build: (decoder: ReturnType<typeof fakeBandDecoder>, pyramid: Pyramid) => BandBuild;
  tile: (ref: TileRef) => Promise<Uint8ClampedArray>;
}

const HASH = 'a'.repeat(64);

function bench(backend = new MemoryTileBackend()): Bench {
  const store = new TileStore({ backend, estimateQuota: () => Promise.resolve(null) });
  const graphics = new PixelGraphics();
  const events: TileEvent[] = [];
  return {
    store,
    events,
    build: (decoder, pyramid) => new BandBuild(HASH, pyramid, new Uint8Array(16), decoder, { store, graphics, yieldToRequests: () => Promise.resolve(), emit: (event) => { events.push(event); } }),
    tile: async (ref) => {
      const blob = await store.getTile(HASH, ref);
      if (!blob) throw new Error(`no tile ${tileKey(ref)}`);
      return (await graphics.decode(blob) as PixelBitmap).data;
    },
  };
}

describe('a pyramid built from bands', () => {
  useReadableBlobs();

  it('plans an eighth pass for the coarse levels and a full pass for the three finest, or one pass for a small map', () => {
    expect(bandPasses(pyramidOf(4100, 3000))).toEqual([{ reduce: 8, baseLevel: 3, lastLevel: 4 }, { reduce: 1, baseLevel: 0, lastLevel: 2 }]);
    expect(bandPasses(pyramidOf(1000, 700))).toEqual([{ reduce: 1, baseLevel: 0, lastLevel: 1 }]);
  });

  it('writes every tile of every level with the very pixels of the whole image, the coarse levels from the eighth', async () => {
    const [width, height] = [2100, 1300];
    const pyramid = pyramidOf(width, height);
    const b = bench();
    const decoder = fakeBandDecoder({ width, height, bandRows: 53 });

    expect(await b.build(decoder, pyramid).run()).toBe('complete');

    expect(decoder.decodes).toEqual([8, 1]);
    expect((await b.store.readManifest(HASH))?.complete).toBe(true);
    const levels = expectedLevels(pyramid, width, height);
    for (const level of pyramid.levels) {
      for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) {
          const ref = { level: level.index, col, row };
          const rect = tileSourceRect(pyramid, ref);
          const expected = crop(new PixelBitmap(level.width, level.height, levels.get(level.index)!), rect);
          expect(await b.tile(ref), tileKey(ref)).toEqual(expected);
        }
      }
    }
    const complete = b.events.filter((event) => event.type === 'complete');
    expect(complete).toHaveLength(1);
  }, 60_000);

  it('stores the coarse levels before any fine tile, so the overview shows while the full pass runs', async () => {
    const [width, height] = [2100, 1300];
    const pyramid = pyramidOf(width, height);
    const b = bench();
    const firstFine: number[] = [];
    const decoder = fakeBandDecoder({ width, height, beforeBand: (y, reduce) => { if (reduce === 1 && y === 0) firstFine.push(b.events.filter((e) => e.type === 'progress').length); } });

    await b.build(decoder, pyramid).run();

    const coarseTiles = pyramid.levels.slice(3).reduce((sum, level) => sum + level.cols * level.rows, 0);
    const progress = b.events.filter((event): event is Extract<TileEvent, { type: 'progress' }> => event.type === 'progress');
    expect(progress[firstFine[0]! - 1]?.done).toBe(coarseTiles);
  });

  it('answers a request for a tile once the build reaches it, and rejects the rest when it stops', async () => {
    // 600 × 1100: one pass, three tile rows at level 0; stopping at row 700 leaves the first written and the second not.
    const [width, height] = [600, 1100];
    const pyramid = pyramidOf(width, height);
    expect(bandPasses(pyramid)).toHaveLength(1);
    const b = bench();
    let stopAt: (() => void) | null = null;
    const decoder = fakeBandDecoder({ width, height, bandRows: 100, beforeBand: (y) => { if (y === 700) stopAt?.(); } });
    const build = b.build(decoder, pyramid);
    stopAt = () => build.stop();
    const early = build.whenStored({ level: 0, col: 0, row: 0 });
    const late = build.whenStored({ level: 0, col: 0, row: 1 });
    late.catch(() => undefined);

    expect(await build.run()).toBe('stopped');

    await expect(early).resolves.toBeUndefined();
    await expect(late).rejects.toThrow(/stopped/);
    await expect(build.whenStored({ level: 0, col: 0, row: 0 })).resolves.toBeUndefined();
    await expect(build.whenStored({ level: 0, col: 0, row: 2 })).rejects.toThrow(/stopped/);
  });

  it('resumes from what an earlier build wrote, decoding only the pass with tiles missing', async () => {
    const [width, height] = [4100, 3000];
    const pyramid = pyramidOf(width, height);
    const backend = new MemoryTileBackend();
    const first = bench(backend);
    const stopping = fakeBandDecoder({ width, height, bandRows: 500, beforeBand: (y, reduce) => { if (reduce === 1 && y === 1000) stoppable.stop(); } });
    const stoppable = first.build(stopping, pyramid);
    expect(await stoppable.run()).toBe('stopped');
    const written = (await first.store.existingTiles(HASH)).size;
    expect(written).toBeGreaterThan(0);

    const second = bench(backend);
    const resuming = fakeBandDecoder({ width, height, bandRows: 500 });
    expect(await second.build(resuming, pyramid).run()).toBe('complete');

    // The eighth pass was complete already, so only the full pass ran again.
    expect(resuming.decodes).toEqual([1]);
    const total = pyramid.levels.reduce((sum, level) => sum + level.cols * level.rows, 0);
    expect((await second.store.existingTiles(HASH)).size).toBe(total);
    const levels = expectedLevels(pyramid, width, height);
    const ref = { level: 0, col: 3, row: 4 };
    expect(await second.tile(ref)).toEqual(crop(new PixelBitmap(pyramid.levels[0]!.width, pyramid.levels[0]!.height, levels.get(0)!), tileSourceRect(pyramid, ref)));
  }, 60_000);
});
