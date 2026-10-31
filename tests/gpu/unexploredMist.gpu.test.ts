import { Graphics, RenderTexture } from 'pixi.js';
import { afterEach, describe, expect, it } from 'vitest';
import { LightingEngine } from '../../src/app/pixi/lighting/engine/LightingEngine';
import type { EngineLight, EngineScene } from '../../src/app/pixi/lighting/engine/types';
import { createTestRenderer, renderThroughEngine, type PixelReader } from '../../src/app/pixi/lighting/engine/__tests__/gpuTestUtils';
import type { LightingMode } from '../../src/app/pixi/lighting/engine/compositeFilter';
import { SEES_ALL } from '../../src/app/vision/sight';

const SIZE = 256;
const MAP = 1024;
const camera = { size: SIZE, scale: SIZE / MAP, x: 0, y: 0, tint: 0x6699cc };
const torch: EngineLight = { key: 'a', x: 250, y: 750, bright: 80, dim: 160, flame: 10, color: [1, 0.8, 0.6], intensity: 1, animation: 'none' };
/** Screen points: the torch's centre, and far from it in the dark. */
const LIT = [62, 187] as const;
const DARK = [225, 40] as const;

describe('mist over what the players do not see', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  async function setup(mode: LightingMode, options: Partial<EngineScene>): Promise<{ engine: LightingEngine; look: () => PixelReader }> {
    const renderer = await createTestRenderer(SIZE);
    cleanup.push(() => renderer.destroy());
    const fog = RenderTexture.create({ width: 64, height: 64 });
    const g = new Graphics().rect(0, 0, 64, 64).fill({ color: 0x336699 });
    renderer.render({ container: g, target: fog, clear: true });
    g.destroy();
    cleanup.push(() => fog.destroy(true));
    const engine = new LightingEngine(renderer);
    cleanup.push(() => engine.destroy());
    engine.setEnabled(true);
    engine.setMode(mode);
    engine.update({
      bounds: { width: MAP, height: MAP }, albedo: null, walls: [], lights: [torch], sight: SEES_ALL, sightRadius: 35, cellSize: 70, ambient: 0,
      unexploredTexture: fog, unexploredSoftness: 70, ...options,
    });
    engine.flush();
    return { engine, look: () => renderThroughEngine(engine, renderer, camera) };
  }

  const mist: Partial<EngineScene> = { unexploredMist: true, unexploredMistDensity: 1, unexploredMistColor: '#ffffff' };
  const sum = (pixel: readonly number[]): number => pixel.reduce((total, channel) => total + channel, 0);

  it('pales the fog map in banks and veils, and leaves the lit map and the GM view as they were', async () => {
    const plain = (await setup('player', {})).look();
    const misty = (await setup('player', mist)).look();
    expect(misty(...LIT)).toEqual(plain(...LIT));
    // Over the dark, patches of mist: some pixels much paler than the fog map, not all alike.
    const darkPixels: number[] = [];
    for (let y = 0; y < SIZE / 2; y += 8) for (let x = SIZE / 2; x < SIZE; x += 8) darkPixels.push(sum(misty(x, y)) - sum(plain(x, y)));
    expect(Math.max(...darkPixels)).toBeGreaterThan(150);
    expect(Math.max(...darkPixels) - Math.min(...darkPixels)).toBeGreaterThan(100);
    const gmPlain = (await setup('gm', {})).look();
    const gmMisty = (await setup('gm', mist)).look();
    expect(gmMisty(...DARK)).toEqual(gmPlain(...DARK));
  });

  it('moves as its clock moves on', async () => {
    const { engine, look } = await setup('player', mist);
    const before = look();
    engine.setMistClock(30, { x: 2, y: 1 });
    const after = look();
    let changed = 0;
    for (let y = 0; y < SIZE / 2; y += 8) for (let x = SIZE / 2; x < SIZE; x += 8) if (Math.abs(sum(after(x, y)) - sum(before(x, y))) > 20) changed++;
    expect(changed).toBeGreaterThan(20);
  });
});
