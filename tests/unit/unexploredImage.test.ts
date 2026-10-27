import { describe, expect, it, vi } from 'vitest';
import { UNEXPLORED_IMAGE_MAX_SIDE, UnexploredImage, unexploredPlacement } from '../../src/app/pixi/lighting/UnexploredImage';
import { imageToWorld, type MapStretch } from '../../src/app/grid/mapStretch';

describe('UnexploredImage', () => {
  it('reads nothing without a path and each path once, at the fog map size', () => {
    const read = vi.fn(() => new Promise<null>(() => undefined));
    const image = new UnexploredImage(read, () => undefined);
    expect(image.textureOf(null)).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(image.textureOf('Maps/fog.png')).toBeNull();
    expect(image.textureOf('Maps/fog.png')).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith('Maps/fog.png', UNEXPLORED_IMAGE_MAX_SIDE);
  });

  it('makes no texture of a file that is gone, and reports nothing ready', async () => {
    const ready = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const image = new UnexploredImage(() => Promise.resolve(null), ready);
    image.textureOf('Maps/gone.png');
    await Promise.resolve();
    await Promise.resolve();
    expect(image.textureOf('Maps/gone.png')).toBeNull();
    expect(ready).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('drops a read that finishes after its path was replaced', async () => {
    let finish: (value: null) => void = () => undefined;
    const ready = vi.fn();
    const image = new UnexploredImage(() => new Promise((resolve) => { finish = resolve; }), ready);
    image.textureOf('Maps/old.png');
    const late = finish;
    image.textureOf(null);
    late(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
  });

  it('places the fog map exactly where its map image is drawn: stretched, turned and placed in', () => {
    const size = { width: 400, height: 300 };
    const stretches: MapStretch[] = [{ x: 1, y: 1 }, { x: 1.2, y: 1 }, { x: 1, y: 1.1, rotation: 3, offset: { x: 70, y: 140 } }];
    for (const stretch of stretches) {
      const toUv = unexploredPlacement({ size, stretch });
      for (const pixel of [{ x: 0, y: 0 }, { x: 400, y: 300 }, { x: 123, y: 45 }]) {
        const uv = toUv.apply(imageToWorld(pixel, size, stretch));
        expect(uv.x).toBeCloseTo(pixel.x / size.width, 6);
        expect(uv.y).toBeCloseTo(pixel.y / size.height, 6);
      }
    }
  });
});

describe('UnexploredImage with a video', () => {
  it('gives up a video too large to draw, releasing it, and reports nothing ready', async () => {
    const release = vi.fn();
    const ready = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const element = { videoWidth: 9000, videoHeight: 4000 } as HTMLVideoElement;
    const image = new UnexploredImage(() => Promise.resolve({ kind: 'video', video: { element, release } }), ready);
    image.textureOf('Maps/fog.mp4');
    await Promise.resolve();
    await Promise.resolve();
    expect(release).toHaveBeenCalledTimes(1);
    expect(ready).not.toHaveBeenCalled();
    expect(image.textureOf('Maps/fog.mp4')).toBeNull();
    warn.mockRestore();
  });
});
