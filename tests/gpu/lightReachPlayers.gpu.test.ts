import '../setup/obsidianDom';
import { Application, RenderTexture, Sprite, Texture, Ticker, WebGLRenderer } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { commands } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { createViewAtlasStore, type ViewAtlasState } from '../../src/app/storeFactory';
import type { TokenEntity } from '../../src/app/types';
import type { LightEmission, LightSource } from '../../src/app/types/lightingTypes';
import type { WallSegment } from '../../src/app/types/wallTypes';
import type { MeasurementSettings } from '../../src/app/grid/measurementFormat';
import { LightingRenderer } from '../../src/app/pixi/lighting/LightingRenderer';
import { readRgba } from '../../src/app/pixi/lighting/engine/__tests__/gpuTestUtils';

vi.mock('events', async () => import('eventemitter3'));

const MAP = 1024;
const MEASUREMENT: MeasurementSettings = { mode: 'metric', unitType: 'feet', unitDistance: 5, ruleDistance: 5, diagonalRule: 'equidistant', rangeBands: [], coneAngle: 90 };
const TORCH: LightEmission = { bright: 20, dim: 40, color: '#ffcc88', intensity: 1, animation: 'none', kind: 'torch' };

let wallId = 0;
function wall(x1: number, y1: number, x2: number, y2: number): WallSegment {
  return { id: `w${wallId++}`, kind: 'wall', type: 'solid', p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } };
}

/** Room A (100..500 × 100..500) with an opening (y 400..480) in its east wall into room B (500..900 × 100..900). */
function rooms(): WallSegment[] {
  return [
    wall(100, 100, 900, 100), wall(100, 100, 100, 500), wall(100, 500, 500, 500),
    wall(500, 100, 500, 400), wall(500, 480, 500, 900),
    wall(900, 100, 900, 900), wall(500, 900, 900, 900),
  ];
}

function token(x: number, y: number, vision: TokenEntity['vision']): TokenEntity {
  return { id: 'hero', kind: 'token', imagePath: '', x, y, size: 1, layer: 0, rotation: 0, isHidden: false, vision };
}

function light(x: number, y: number, extra: Partial<LightSource> = {}): LightSource {
  return { id: 'light', kind: 'light', x, y, emission: TORCH, ...extra };
}

async function savePng(pixels: Uint8ClampedArray, name: string): Promise<void> {
  const canvas = new OffscreenCanvas(MAP, MAP);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), MAP, MAP), 0, 0);
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  await commands.writeFile(`out/light-reach/${name}.png`, btoa(binary), 'base64');
}

interface Shot {
  pixels: Uint8ClampedArray;
  /** The colour at world pixel (x, y): the camera shows the map at scale 1. */
  at: (x: number, y: number) => readonly [number, number, number];
}

/**
 * A light in one room and a party token in the next, which sees the floor the light reaches
 * through the opening but not the light. The players' picture shows the light the scene has
 * wherever the token sees, as it does with token vision off: sight decides only where the
 * players look, never which light there is (Fabian's report of 2026-10-23, light that seemed to
 * need a token in its room). Pictures in `out/light-reach/`.
 */
describe('light that reaches a room a party token stands in', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  /** The players' picture of the scene through the view's own lighting, as the canvas shows it in session view. */
  async function picture(objects: Partial<ViewAtlasState['objects']>, lighting: Partial<ViewAtlasState['lighting']>): Promise<Shot> {
    const renderer = new WebGLRenderer();
    await renderer.init({ width: MAP, height: MAP, backgroundAlpha: 1, useBackBuffer: true });
    const app = new Application();
    app.renderer = renderer;
    app.ticker = new Ticker();
    const ticks: (() => void)[] = [];
    app.ticker.add = ((tick: () => void) => (ticks.push(tick), app.ticker)) as Ticker['add'];
    const viewport = new Viewport({ screenWidth: MAP, screenHeight: MAP, worldWidth: MAP, worldHeight: MAP, events: renderer.events });
    viewport.sortableChildren = true;
    app.stage.addChild(viewport);
    const floor = new Sprite(Texture.WHITE);
    floor.setSize(MAP, MAP);
    floor.tint = 0x8a857c;
    viewport.addChild(floor);
    const store = createViewAtlasStore(createInMemoryApp().app, `light-reach-${Math.random()}`);
    store.getState().setPersistenceEnabled(false);
    store.getState().setMapPath('maps/light-reach.atlasmap');
    store.setState((state) => ({ grid: { ...state.grid, size: 50 }, objects: { ...state.objects, ...objects } }));
    store.getState().setSceneLighting({ enabled: true, ambient: 0, ...lighting });
    const view = new LightingRenderer({ viewport, app, store, measurement: () => MEASUREMENT, bounds: () => ({ width: MAP, height: MAP }), albedo: () => null });
    cleanup.push(() => {
      view.destroy();
      app.ticker.destroy();
      viewport.destroy({ children: true });
      app.stage.destroy();
      renderer.destroy();
    });
    // Builds every tile and the bounce, which the paced view would spread over frames.
    view.renderForFrame({ x: 0, y: 0, resolution: 1 }, () => undefined);
    view.modeLayer.visible = true;
    const target = RenderTexture.create({ width: MAP, height: MAP });
    cleanup.push(() => target.destroy(true));
    for (let i = 0; i < 3; i++) {
      renderer.render({ container: app.stage, target, clear: true });
      ticks.forEach((tick) => tick());
    }
    renderer.render({ container: app.stage, target, clear: true });
    const pixels = readRgba(renderer, target);
    return { pixels, at: (x, y) => [pixels[(y * MAP + x) * 4]!, pixels[(y * MAP + x) * 4 + 1]!, pixels[(y * MAP + x) * 4 + 2]!] };
  }

  const sum = (pixel: readonly number[]): number => pixel[0]! + pixel[1]! + pixel[2]!;

  it.each([
    ['point', light(300, 300)],
    ['area', light(300, 300, { area: [{ x: 250, y: 250 }, { x: 350, y: 250 }, { x: 350, y: 350 }, { x: 250, y: 350 }] })],
  ])('shows a %s light in the next room to a token there as with token vision off', async (name, source) => {
    const objects = { walls: Object.fromEntries(rooms().map((w) => [w.id, w])), lights: { light: source }, tokens: { hero: token(800, 800, { enabled: true }) } };
    const seeing = await picture(objects, {});
    const all = await picture(objects, { tokenVision: false });
    await savePng(seeing.pixels, `${name}-vision`);
    await savePng(all.pixels, `${name}-no-vision`);
    let lit = 0;
    // Room B, which the token sees whole; the token's own footprint is left out.
    for (let y = 110; y < 890; y += 2) {
      for (let x = 510; x < 890; x += 2) {
        if (Math.hypot(x - 800, y - 800) < 30) continue;
        const shown = seeing.at(x, y);
        const scene = all.at(x, y);
        // Never darker than the scene's light; where it is brighter than what is remembered, exactly it.
        expect([x, y, sum(shown) >= sum(scene) - 3]).toEqual([x, y, true]);
        if (sum(scene) < 150) continue;
        lit++;
        expect([x, y, shown.every((channel, i) => Math.abs(channel - scene[i]!) <= 2)]).toEqual([x, y, true]);
      }
    }
    // The light reaches into room B through the opening.
    expect(lit).toBeGreaterThan(1000);
  });
});
