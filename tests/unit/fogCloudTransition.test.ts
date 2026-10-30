// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { FogCloudLayer } from '../../src/app/pixi/fog/FogCloudLayer';
import type { FogCoverage } from '../../src/app/fog/fogCoverage';
import { Q_SCALE, type QShape } from '../../src/app/types/shapeTypes';
import * as reveal from '../../src/app/pixi/fog/fogReveal';
import * as clip from '../../src/app/lighting/polygonClip';
import * as cloudCanvas from '../../src/app/pixi/fog/fogCloudCanvas';

const BOUNDS = { x: 0, y: 0, width: 400, height: 400 };

afterEach(() => vi.restoreAllMocks());

const square = (x: number, size: number): QShape => [[x, 0, x + size, 0, x + size, size, x, size].map((value) => value * Q_SCALE)];
const coverage = (shape: QShape): FogCoverage => ({ shape, covers: () => true });

function layer(): FogCloudLayer {
  // jsdom has no Canvas 2D implementation: every call and field gives a stand-in that takes anything.
  const anything: object = new Proxy(function stand() {}, { get: () => anything, apply: () => anything, set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(anything as never);
  // The masks a change is measured on are read back from a canvas: the change is given instead
  vi.spyOn(cloudCanvas, 'sampleFogMask').mockReturnValue({ alpha: [], columns: 0, rows: 0 });
  vi.spyOn(reveal, 'findFogChange').mockReturnValue({ revealed: { points: [{ x: 250, y: 50 }], cellSize: 8 }, covered: { points: [], cellSize: 8 } });
  return new FogCloudLayer({ canvas: createEl('canvas') } as never);
}

it('parts the clouds over a change, keeping the fog both states cover', () => {
  const clouds = layer();
  try {
    clouds.present(coverage(square(0, 300)), BOUNDS, '#232a38');
    clouds.present(coverage(square(0, 200)), BOUNDS, '#232a38');
    expect(clouds.isRevealing).toBe(true);
  } finally {
    clouds.destroy();
  }
});

it('changes the clouds at once where the fog both states cover cannot be drawn, so it never thins', () => {
  const clouds = layer();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    clouds.present(coverage(square(0, 300)), BOUNDS, '#232a38');
    vi.spyOn(clip, 'subtractShapes').mockImplementation(() => {
      throw new Error('clipping failed');
    });
    clouds.present(coverage(square(0, 200)), BOUNDS, '#232a38');
    expect(clouds.isRevealing).toBe(false);
    expect(clouds.hasClouds).toBe(true);
    expect(clouds.container.children.map((child) => child.alpha)).toEqual([1]);
  } finally {
    clouds.destroy();
  }
});
