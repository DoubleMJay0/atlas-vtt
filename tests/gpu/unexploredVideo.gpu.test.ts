import { afterEach, describe, expect, it } from 'vitest';
import { LightingEngine } from '../../src/app/pixi/lighting/engine/LightingEngine';
import type { EngineScene } from '../../src/app/pixi/lighting/engine/types';
import { createTestRenderer, renderThroughEngine } from '../../src/app/pixi/lighting/engine/__tests__/gpuTestUtils';
import { UnexploredImage } from '../../src/app/pixi/lighting/UnexploredImage';
import { openVideoElement } from '../../src/app/pixi/mapImage/video/videoElement';
import { SEES_ALL } from '../../src/app/vision/sight';
import { videoMapWebm } from '../fixtures/videoMapFixture';

const SIZE = 128;
const MAP = 1024;
const camera = { size: SIZE, scale: SIZE / MAP, x: 0, y: 0 };
type Colour = 'blue' | 'red' | 'green' | 'yellow' | 'other';

/** Names a pixel by its channels; video decoding moves them a little. */
function nameOf([r, g, b]: readonly number[]): Colour {
  const high = (value: number): boolean => value > 180;
  const low = (value: number): boolean => value < 70;
  if (low(r!) && low(g!) && high(b!)) return 'blue';
  if (high(r!) && low(g!) && low(b!)) return 'red';
  if (low(r!) && high(g!) && low(b!)) return 'green';
  if (high(r!) && high(g!) && low(b!)) return 'yellow';
  return 'other';
}

async function until(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = performance.now() + timeoutMs;
  while (performance.now() < end) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return check();
}

describe('a video fog map', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  it('shows its first frame over never-seen areas, then plays frame after frame', async () => {
    const renderer = await createTestRenderer(SIZE);
    cleanup.push(() => renderer.destroy());
    let ready = false;
    let frames = 0;
    const fog = new UnexploredImage(
      async () => ({ kind: 'video', video: await openVideoElement(document, videoMapWebm(), 'video/webm') }),
      () => { ready = true; },
      () => { frames++; },
    );
    cleanup.push(() => fog.destroy());
    expect(fog.textureOf('fog.webm')).toBeNull();
    expect(await until(() => ready, 5000)).toBe(true);
    const texture = fog.textureOf('fog.webm');
    expect(texture).not.toBeNull();

    const engine = new LightingEngine(renderer);
    cleanup.push(() => engine.destroy());
    engine.setEnabled(true);
    engine.setMode('player');
    const scene: EngineScene = { bounds: { width: MAP, height: MAP }, albedo: null, walls: [], lights: [], sight: SEES_ALL, sightRadius: 20, ambient: 0, unexploredTexture: texture };
    engine.update(scene);
    engine.flush();
    const look = (): Colour[] => {
      const at = renderThroughEngine(engine, renderer, camera);
      return [nameOf(at(SIZE / 4, SIZE / 2)), nameOf(at((3 * SIZE) / 4, SIZE / 2))];
    };
    // Unlit and paused, the players see the video's first frame: blue on the left, red on the right.
    expect(look()).toEqual(['blue', 'red']);

    fog.setMode('play');
    // The second second of the video is green and yellow: only its frames show that.
    expect(await until(() => look()[0] === 'green', 4000)).toBe(true);
    expect(look()).toEqual(['green', 'yellow']);
    expect(frames).toBeGreaterThan(0);
  });
});
