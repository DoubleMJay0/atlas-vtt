import { BufferImageSource, Matrix, Texture } from 'pixi.js';
import { afterEach, describe, expect, it } from 'vitest';
import { srgbToLinear } from '../../../../lighting/srgb';
import type { Point } from '../../../../types/visionTypes';
import { SEES_ALL } from '../../../../vision/sight';
import { LightingEngine } from '../LightingEngine';
import { ReliefMap, type ReliefImage } from '../ReliefMap';
import type { EngineLight } from '../types';
import { createTestRenderer, renderThroughEngine } from './gpuTestUtils';
import { watchGl } from './strictGl';

const SIZE = 512;
const MAP = 1024;
const FLOOR = 0x808080;
/** World pixels per relief texel. */
const RELIEF_TEXEL = 8;

function flatMap(colour: number): Texture {
  const pixels = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff, 255], i);
  return new Texture({ source: new BufferImageSource({ resource: pixels, width: 4, height: 4 }) });
}

function luminance([r, g, b]: readonly [number, number, number]): number {
  return 0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255);
}

interface Standing {
  at: Point;
  radius: number;
  height: number;
}

/** A relief over the whole map: discs standing on a flat floor. */
function relief(standing: readonly Standing[]): ReliefMap {
  const side = MAP / RELIEF_TEXEL;
  const heights = new Uint8Array(side * side);
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const x = (i + 0.5) * RELIEF_TEXEL, y = (j + 0.5) * RELIEF_TEXEL;
      for (const { at, radius, height } of standing) if (Math.hypot(x - at.x, y - at.y) <= radius) heights[j * side + i] = Math.max(heights[j * side + i]!, Math.round(height * 255));
    }
  }
  const image: ReliefImage = { width: side, height: side, heights };
  return new ReliefMap(image, new Matrix(MAP, 0, 0, MAP, 0, 0));
}

function lamp(key: string, at: Point): EngineLight {
  return { key, x: at.x, y: at.y, bright: 150, dim: 420, flame: 24, color: [1, 1, 1], intensity: 1, animation: 'none' };
}

const PILLAR: Standing = { at: { x: 512, y: 512 }, radius: 40, height: 1 };

describe('shadows from heights', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  /** The players' picture of a grey floor without ambient light, lit by `lights`, over `standing`, as luminance by world point. */
  async function picture(lights: EngineLight[], standing: readonly Standing[] | null): Promise<(point: Point) => number> {
    const renderer = await createTestRenderer(SIZE);
    cleanup.push(() => renderer.destroy());
    const watch = watchGl(renderer.gl);
    cleanup.push(() => watch.stop());
    const engine = new LightingEngine(renderer);
    cleanup.push(() => engine.destroy());
    const albedo = flatMap(FLOOR);
    cleanup.push(() => albedo.destroy(true));
    const map = standing ? relief(standing) : null;
    engine.setEnabled(true);
    engine.setMode('player');
    engine.update({ bounds: { width: MAP, height: MAP }, albedo, walls: [], lights, sight: SEES_ALL, sightRadius: 20, ambient: 0, relief: map?.relief ?? null });
    engine.flush();
    const read = renderThroughEngine(engine, renderer, { size: SIZE, scale: SIZE / MAP, x: 0, y: 0, tint: FLOOR, map: MAP });
    // The relief's passes are valid under the strict context.
    expect(watch.findings).toEqual([]);
    cleanup.push(() => map?.destroy());
    return (point) => luminance(read(point.x * SIZE / MAP, point.y * SIZE / MAP));
  }

  it("casts an object's shadow away from the lamp and keeps its top lit", async () => {
    const light = lamp('lamp', { x: 512, y: 300 });
    const shaded = await picture([light], [PILLAR]);
    const open = await picture([light], null);
    // Behind the pillar, seen from the lamp: in its shadow.
    const behind = { x: 512, y: 660 };
    expect(shaded(behind)).toBeLessThan(open(behind) * 0.35);
    // Its top, and the floor before and beside it, stay as lit as without it.
    for (const point of [{ x: 512, y: 512 }, { x: 512, y: 440 }, { x: 640, y: 560 }]) expect(shaded(point)).toBeGreaterThan(open(point) * 0.9);
  });

  it('casts a second shadow from a second lamp, each pointing away from its own', async () => {
    const lights = [lamp('north', { x: 512, y: 300 }), lamp('west', { x: 300, y: 512 })];
    const shaded = await picture(lights, [PILLAR]);
    const open = await picture(lights, null);
    // South of the pillar the north lamp's shadow, east of it the west lamp's: each keeps the other lamp's light.
    for (const point of [{ x: 512, y: 680 }, { x: 680, y: 512 }]) {
      expect(shaded(point)).toBeLessThan(open(point) * 0.8);
      expect(shaded(point)).toBeGreaterThan(open(point) * 0.15);
    }
    // Beyond the lamps' corner the floor stays lit.
    expect(shaded({ x: 680, y: 680 })).toBeGreaterThan(open({ x: 680, y: 680 }) * 0.9);
  });

  it('lets a low stone cast a short shadow only', async () => {
    const light = lamp('lamp', { x: 512, y: 300 });
    const stone: Standing = { at: { x: 512, y: 420 }, radius: 16, height: 0.12 };
    const shaded = await picture([light], [stone]);
    const open = await picture([light], null);
    // Right behind it: shaded; well beyond, where the line from the floor to the lamp passes over it: lit.
    expect(shaded({ x: 512, y: 450 })).toBeLessThan(open({ x: 512, y: 450 }) * 0.6);
    expect(shaded({ x: 512, y: 560 })).toBeGreaterThan(open({ x: 512, y: 560 }) * 0.9);
  });

  it('draws a scene without a relief exactly as before reliefs', async () => {
    const light = lamp('lamp', { x: 512, y: 300 });
    const none = await picture([light], null);
    const flat = await picture([light], []);
    for (const point of [{ x: 512, y: 512 }, { x: 512, y: 660 }, { x: 300, y: 300 }, { x: 700, y: 420 }]) expect(flat(point)).toBeCloseTo(none(point), 3);
  });
});
