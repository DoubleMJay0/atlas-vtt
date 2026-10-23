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
  return { key, x: at.x, y: at.y, bright: 200, dim: 640, flame: 24, color: [1, 1, 1], intensity: 1, animation: 'none' };
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

  it('lets lava, glowing at its surface, throw long low shadows of what stands near it', async () => {
    // A field of lava along the west of the map, its shore at x 300.
    const lava: EngineLight = {
      key: 'lava', x: 200, y: 512, bright: 120, dim: 480, flame: 0, color: [1, 0.5, 0.2], intensity: 1, animation: 'none',
      surface: [{ x: 100, y: 312 }, { x: 300, y: 312 }, { x: 300, y: 712 }, { x: 100, y: 712 }],
    };
    const stone: Standing = { at: { x: 420, y: 512 }, radius: 20, height: 0.08 };
    const shaded = await picture([lava], [stone]);
    const open = await picture([lava], null);
    // Behind the low stone, well beyond it, its shadow still lies (the lava is wide: it fills in part of it); before it and clear of its fan the floor is lit.
    expect(shaded({ x: 520, y: 512 })).toBeLessThan(open({ x: 520, y: 512 }) * 0.8);
    expect(shaded({ x: 380, y: 512 })).toBeGreaterThan(open({ x: 380, y: 512 }) * 0.9);
    expect(shaded({ x: 520, y: 250 })).toBeGreaterThan(open({ x: 520, y: 250 }) * 0.9);
    // The lava itself and the stone's top stay as lit.
    expect(shaded({ x: 200, y: 512 })).toBeGreaterThan(open({ x: 200, y: 512 }) * 0.98);
    expect(shaded({ x: 420, y: 512 })).toBeGreaterThan(open({ x: 420, y: 512 }) * 0.85);
  });

  it.each([[undefined], [400]])('draws the edges of a shadow straight and soft, not as a staircase of relief texels, seen close up (cell %s px)', async (cellSize) => {
    // A lamp with a small flame west of the pillar: the edges of the shadow are straight lines from it past the pillar's sides.
    const light: EngineLight = { ...lamp('lamp', { x: 300, y: 512 }), bright: 600, dim: 900, flame: 4 };
    const renderer = await createTestRenderer(SIZE);
    cleanup.push(() => renderer.destroy());
    const engine = new LightingEngine(renderer);
    cleanup.push(() => engine.destroy());
    const albedo = flatMap(FLOOR);
    cleanup.push(() => albedo.destroy(true));
    const map = relief([PILLAR]);
    cleanup.push(() => map.destroy());
    engine.setEnabled(true);
    engine.setMode('player');
    engine.update({ bounds: { width: MAP, height: MAP }, albedo, walls: [], lights: [light], sight: SEES_ALL, sightRadius: 20, ambient: 0, relief: map.relief, ...(cellSize && { cellSize }) });
    engine.flush();
    // Four screen pixels a world pixel, over the shadow's northern edge.
    const [scale, left, top] = [4, 620, 400];
    const read = renderThroughEngine(engine, renderer, { size: SIZE, scale, x: -left * scale, y: -top * scale, tint: FLOOR, map: MAP });
    const at = (x: number, y: number): number => luminance(read(Math.round((x - left) * scale), Math.round((y - top) * scale)));
    // The edge: where each column of the picture turns from lit to shadow, half way.
    const tangent = Math.asin(PILLAR.radius / (PILLAR.at.x - light.x));
    const crossings: Point[] = [];
    for (let x = left + 4; x < left + SIZE / scale - 4; x += 2) {
      const ideal = light.y - Math.tan(tangent) * (x - light.x);
      const [lit, dark] = [at(x, ideal - 24), at(x, ideal + 24)];
      if (lit - dark < 0.02) continue;
      for (let y = ideal - 24; y < ideal + 24; y += 1 / scale) {
        if (at(x, y) < (lit + dark) / 2) {
          crossings.push({ x, y });
          break;
        }
      }
    }
    expect(crossings.length).toBeGreaterThan(20);
    // A straight line through them, and how far the edge strays from it.
    const n = crossings.length;
    const [mx, my] = [crossings.reduce((sum, p) => sum + p.x, 0) / n, crossings.reduce((sum, p) => sum + p.y, 0) / n];
    const slope = crossings.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0) / crossings.reduce((sum, p) => sum + (p.x - mx) ** 2, 0);
    const stray = Math.max(...crossings.map((p) => Math.abs(p.y - (my + slope * (p.x - mx)))));
    console.info(`shadow edge strays ${stray.toFixed(2)} world px from a straight line (relief texel ${RELIEF_TEXEL} px, cell ${cellSize ?? 'unknown'})`);
    // Traced from each texel's middle alone it strayed 1.7 px: a staircase of whole relief texels.
    expect(stray).toBeLessThan(RELIEF_TEXEL * 0.15);
  });

  it('draws a scene without a relief exactly as before reliefs', async () => {
    const light = lamp('lamp', { x: 512, y: 300 });
    const none = await picture([light], null);
    const flat = await picture([light], []);
    for (const point of [{ x: 512, y: 512 }, { x: 512, y: 660 }, { x: 300, y: 300 }, { x: 700, y: 420 }]) expect(flat(point)).toBeCloseTo(none(point), 3);
  });
});
