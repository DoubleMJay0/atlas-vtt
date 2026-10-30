// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BandUnsupportedError } from '../../../../src/app/imageProcessing/band/bandTypes';
import { bandBuildCost } from '../../../../src/app/pixi/mapImage/band/bandBuild';
import { decodedSizeCost } from '../../../../src/app/pixi/mapImage/decodedLevels';
import { pyramidOf, tileKey } from '../../../../src/app/pixi/mapImage/pyramid';
import { coreHarness, fakePng, useReadableBlobs } from '../fakeTileGraphics';
import { fakeBandDecoder } from './fakeBandDecoder';

/**
 * The tile core on an image the browser cannot decode: the band decoder gives the pyramid, the
 * build writes rows, and requests for tiles it has not reached wait. The fake PNG header stands in
 * for a huge file; the fake decoder is handed in, as the real lookup would refuse so small an image.
 */
describe('the tile core reading a map in bands', () => {
  useReadableBlobs();

  it('opens the map with the pyramid the decoder names and serves a tile once the build has written it', async () => {
    const [width, height] = [2100, 1300];
    const decoder = fakeBandDecoder({ width, height, bandRows: 200 });
    const h = coreHarness({ bandDecoderOf: () => Promise.resolve(decoder) });
    const identity = { path: 'huge.png', size: 32, mtime: 1 };

    expect(await h.core.open(identity, null)).toEqual({ kind: 'need-bytes' });
    const opened = await h.core.open(identity, fakePng(width, height));
    if (opened.kind !== 'opened') throw new Error(opened.kind);

    expect(opened.opened.pyramid).toEqual(pyramidOf(width, height));
    // Asked before the build reaches it: waits for the tile rather than failing on the cache miss.
    const tile = await h.core.tile(1, opened.opened.handle, { level: 0, col: 1, row: 1 }).catch(() => null);
    expect(h.events.filter((event) => event.type === 'build-failed')).toEqual([]);
    expect(tile?.width).toBe(512);
    await h.completed(opened.opened.hash);
    expect(decoder.decodes).toEqual([8, 1]);
    expect(h.graphics.bitmaps.filter((bitmap) => bitmap.origin === 'pixels').length).toBeGreaterThan(0);
    const total = pyramidOf(width, height).levels.reduce((sum, level) => sum + level.cols * level.rows, 0);
    expect((await h.store.existingTiles(opened.opened.hash)).size).toBe(total);
    // Served from the cache now, with the overview composed from the coarse levels.
    const overview = await h.core.overview(2, opened.opened.handle, 256);
    expect(overview && Math.max(overview.width, overview.height)).toBe(256);
    h.core.close(opened.opened.handle);
  }, 60_000);

  it('composes the overview asked for before the build wrote a tile, waiting for all of them at once, and the build goes on', async () => {
    const [width, height] = [4100, 3000];
    const decoder = fakeBandDecoder({ width, height, bandRows: 200 });
    const h = coreHarness({ bandDecoderOf: () => Promise.resolve(decoder) });
    const opened = await h.core.open({ path: 'huge.png', size: 32, mtime: 1 }, fakePng(width, height));
    if (opened.kind !== 'opened') throw new Error(opened.kind);

    // Every tile of the overview's level is waited for under one request; the build must not wait for that request in turn.
    const overview = await h.core.overview(7, opened.opened.handle, 1024);

    expect(overview && Math.max(overview.width, overview.height)).toBe(1024);
    await h.completed(opened.opened.hash);
    expect(h.events.filter((event) => event.type === 'build-failed')).toEqual([]);
    h.core.close(opened.opened.handle);
  }, 30_000);

  it('reports what the decoder refuses, with the header\'s size, instead of trying to decode', async () => {
    const decoder = {
      ...fakeBandDecoder({ width: 20, height: 10 }),
      inspect: () => { throw new BandUnsupportedError('progressive', 'progressive JPEG'); },
    };
    const h = coreHarness({ bandDecoderOf: () => Promise.resolve(decoder) });

    const outcome = await h.core.open({ path: 'turned.png', size: 32, mtime: 1 }, fakePng(20000, 20000));

    expect(outcome).toEqual({ kind: 'failed', failure: { kind: 'unsupported', width: 20000, height: 20000, reason: 'progressive' } });
    expect(decoder.decodes).toEqual([]);
  });

  it('resumes a build that gave way to a map being opened, skipping the tiles it wrote', async () => {
    const [width, height] = [4100, 3000];
    let stops = 0;
    const decoder = fakeBandDecoder({ width, height, bandRows: 400 });
    // Room for the band build alone, not for it and the second map's decoded levels together.
    const h = coreHarness({ bandDecoderOf: () => Promise.resolve(decoder), decodedBudget: bandBuildCost(width, 32) + decodedSizeCost(300, 200) - 1 });
    const identity = { path: 'huge.png', size: 32, mtime: 1 };
    const prebuilt = h.core.prebuild(identity, fakePng(width, height));
    // A second map opening makes the prebuild, which nobody shows, give way.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const other = await h.core.open({ path: 'small.png', size: 32, mtime: 2 }, fakePng(300, 200));
    if (other.kind !== 'opened') throw new Error(other.kind);
    const first = await prebuilt;
    if (first.kind !== 'prebuilt') throw new Error(first.kind);
    if (!first.complete) stops += 1;
    h.core.close(other.opened.handle);

    const again = await h.core.prebuild(identity, fakePng(width, height));

    expect(again).toMatchObject({ kind: 'prebuilt', complete: true });
    const total = pyramidOf(width, height).levels.reduce((sum, level) => sum + level.cols * level.rows, 0);
    expect((await h.store.existingTiles(first.hash)).size).toBe(total);
    expect(new Set((await h.store.existingTiles(first.hash))).has(tileKey({ level: 0, col: 0, row: 0 }))).toBe(true);
    expect(stops).toBeLessThanOrEqual(1);
  }, 60_000);
});
