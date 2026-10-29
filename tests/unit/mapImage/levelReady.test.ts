// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MemoryTileBackend } from '../../../src/app/pixi/mapImage/memoryTileBackend';
import { pyramidOf } from '../../../src/app/pixi/mapImage/pyramid';
import type { StoredLevel } from '../../../src/app/pixi/mapImage/tileBlobs';
import { TileDecoderClient } from '../../../src/app/pixi/mapImage/TileDecoderClient';
import type { CoreFactory } from '../../../src/app/pixi/mapImage/tileCoreHost';
import { inThreadPort, type PortFactory } from '../../../src/app/pixi/mapImage/tilePorts';
import { sha256 } from '../../../src/app/utils/hashing';
import { coreHarness, fakePng, useReadableBlobs } from './fakeTileGraphics';

const identity = { path: 'maps/keep.png', size: 1234, mtime: 99 };
/** 3000 × 2000: levels of 24, 6, 2 and 1 tiles; the build writes level 3 first and level 0 last. */
const PYRAMID = pyramidOf(3000, 2000);
const tilesOf = (level: number): number => PYRAMID.levels[level]!.cols * PYRAMID.levels[level]!.rows;

describe('a level of a pyramid waited for in the tile worker', () => {
  useReadableBlobs();

  it('is answered as the build stores it, the coarsest first, before the build ends, with each tile\'s stored size', async () => {
    const h = coreHarness();
    const bytes = fakePng(3000, 2000);
    const hash = await sha256(bytes);
    const answered: { level: number; encoded: number; stored: StoredLevel | null }[] = [];
    // Asked before anything of the map is in the cache: the waits outlast the build's start.
    for (const [id, level] of [[1, 0], [2, 3], [3, 1]] as const) {
      void h.core.levelReady(id, hash, level).then((stored) => answered.push({ level, encoded: h.graphics.encodes.length, stored }));
    }
    await h.core.prebuild(identity, bytes);
    await h.completed(hash);
    await vi.waitFor(() => expect(answered).toHaveLength(3));
    expect(answered.map((answer) => answer.level)).toEqual([3, 1, 0]);
    // Level 3 went before the finer levels were cut.
    expect(answered[0]!.encoded).toBeLessThan(33);
    for (const { level, stored } of answered) {
      expect(stored).toMatchObject({ width: 3000, height: 2000, decodedScale: 1, level });
      expect(stored?.tiles).toHaveLength(tilesOf(level));
      expect(stored?.tiles.every((tile) => tile.level === level && tile.bytes > 0)).toBe(true);
    }
  });

  it('is answered at once where the cache holds it whole', async () => {
    const h = coreHarness();
    const bytes = fakePng(3000, 2000);
    const { hash } = (await h.core.prebuild(identity, bytes)) as { hash: string };
    const stored = await h.core.levelReady(1, hash, 2);
    expect(stored?.tiles.map(({ col, row }) => [col, row])).toEqual([[0, 0], [1, 0]]);
  });

  it('answers nothing once cancelled, and refuses a level outside the pyramid', async () => {
    const h = coreHarness();
    const waiting = h.core.levelReady(1, 'f'.repeat(64), 0);
    h.core.cancel(1);
    expect(await waiting).toBeNull();
    const { hash } = (await h.core.prebuild(identity, fakePng(3000, 2000))) as { hash: string };
    await expect(h.core.levelReady(2, hash, 9)).rejects.toThrow(/outside the pyramid/);
  });

  it('rejects when the worker stops, and is answered when asked of the next one', async () => {
    const backend = new MemoryTileBackend();
    const createCore: CoreFactory = (_appId, emit) => Promise.resolve(coreHarness({ backend, forward: emit }).core);
    const crashes: ((reason: string) => void)[] = [];
    const worker: PortFactory = (receive, crash) => {
      crashes.push(crash);
      return inThreadPort(createCore)(receive, crash);
    };
    const client = new TileDecoderClient({ appId: 'vault-1', worker, inThread: inThreadPort(createCore) });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bytes = fakePng(3000, 2000);
    const hash = await sha256(bytes);
    const waiting = client.levelReady(hash, 1);
    crashes.at(-1)!('out of memory');
    await expect(waiting).rejects.toThrow('out of memory');
    const again = client.levelReady(hash, 1);
    await client.ensurePyramid(bytes.slice(0), identity);
    expect((await again).tiles).toHaveLength(tilesOf(1));
    client.dispose();
  });

  it('is cancelled in the worker when its signal aborts', async () => {
    const backend = new MemoryTileBackend();
    const harnesses: ReturnType<typeof coreHarness>[] = [];
    const createCore: CoreFactory = (_appId, emit) => {
      const harness = coreHarness({ backend, forward: emit });
      harnesses.push(harness);
      return Promise.resolve(harness.core);
    };
    const noWorker: PortFactory = () => {
      throw new Error('Workers are not allowed here');
    };
    const client = new TileDecoderClient({ appId: 'vault-1', worker: noWorker, inThread: inThreadPort(createCore) });
    const controller = new AbortController();
    const waiting = client.levelReady('f'.repeat(64), 0, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toThrow();
    await vi.waitFor(() => expect(harnesses).toHaveLength(1));
    const cancel = vi.spyOn(harnesses[0]!.core, 'cancel');
    const second = new AbortController();
    void client.levelReady('e'.repeat(64), 0, second.signal).catch(() => undefined);
    second.abort();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalled());
    client.dispose();
  });
});
