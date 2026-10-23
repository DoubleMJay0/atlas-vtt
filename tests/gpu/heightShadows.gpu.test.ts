import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WebGLRenderer } from 'pixi.js';
import type { DungeonStyleId } from '../../src/app/dungeons/styleCatalog';
import { createTestRenderer } from '../../src/app/pixi/lighting/engine/__tests__/gpuTestUtils';
import { savePng } from './dungeonRenderHarness';
import { shadedFloor, shoot, standingThing, torchAt, type Lit, type ShadedFloor } from './heightShadowsHarness';

/** A temple with colonnades, statues and rubble: things that stand, low and tall. */
const TEMPLE = { seed: 404, tags: ['round', 'colonnades', 'temple', 'crumbling'], floors: 1 };
const PX_PER_CELL = 80;
/** Scriptorium, Ember and Ink: two Stone & shadow looks, light and dark, and an Engraved one. */
const LOOKS: readonly DungeonStyleId[] = ['parchment', 'volcanic', 'print'];
const OUT = 'height-shadows';

interface Camera { scale: number; x: number; y: number; width: number; height: number }

function canvasOf(pixels: Uint8ClampedArray, width: number, height: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
  return canvas;
}

/**
 * How far two pictures lie apart: the mean of every channel's difference, and the share of pixels
 * any channel of which differs by more than `far`; only over the pixels `counted` keeps, where given.
 */
function difference(a: Uint8ClampedArray, b: Uint8ClampedArray, far = 24, counted?: (k: number) => boolean): { mean: number; farShare: number } {
  let sum = 0;
  let farCount = 0;
  let pixels = 0;
  for (let k = 0; k < a.length; k += 4) {
    if (counted && !counted(k)) continue;
    pixels++;
    const d = Math.max(Math.abs(a[k]! - b[k]!), Math.abs(a[k + 1]! - b[k + 1]!), Math.abs(a[k + 2]! - b[k + 2]!));
    sum += Math.abs(a[k]! - b[k]!) + Math.abs(a[k + 1]! - b[k + 1]!) + Math.abs(a[k + 2]! - b[k + 2]!);
    if (d > far) farCount++;
  }
  return { mean: sum / Math.max(1, pixels * 3), farShare: farCount / Math.max(1, pixels) };
}

describe('shadows from heights on a generated dungeon', () => {
  let renderer: WebGLRenderer;
  const floors = new Map<DungeonStyleId, ShadedFloor>();
  beforeAll(async () => {
    renderer = await createTestRenderer(64);
  });
  afterAll(() => {
    for (const floor of floors.values()) floor.destroy();
    renderer.destroy();
  });

  const floorOf = (look: DungeonStyleId): ShadedFloor => {
    if (!floors.has(look)) floors.set(look, shadedFloor(TEMPLE, look, PX_PER_CELL));
    return floors.get(look)!;
  };
  const whole = (floor: ShadedFloor): Camera => {
    const scale = Math.min(1600 / floor.layout.widthPx, 1200 / floor.layout.heightPx);
    return { scale, x: 0, y: 0, width: Math.round(floor.layout.widthPx * scale), height: Math.round(floor.layout.heightPx * scale) };
  };
  /** A window of the floor round `cell`, 12 by 8 cells at `px` a cell. */
  const closeUp = (floor: ShadedFloor, cell: { x: number; y: number }, px = 160, cells = 12, rows = 8): Camera => {
    const { originCell, pxPerCell } = floor.layout;
    return { scale: px / pxPerCell, x: (cell.x - originCell.x - cells / 2) * pxPerCell, y: (cell.y - originCell.y - rows / 2) * pxPerCell, width: cells * px, height: rows * px };
  };
  const save = async (pixels: Uint8ClampedArray, camera: Camera, name: string): Promise<void> => savePng(canvasOf(pixels, camera.width, camera.height), `../${OUT}/${name}`);

  for (const look of LOOKS) {
    it(`${look}: without lighting, the map with its shade looks as the baked map`, async () => {
      const floor = floorOf(look);
      const camera = whole(floor);
      const today = shoot(renderer, floor, null, camera, true);
      const shaded = shoot(renderer, floor, null, camera);
      await save(today, camera, `${look}-1-baked`);
      await save(shaded, camera, `${look}-2-unlit-shade`);
      const d = difference(today, shaded);
      console.log(`${look} unlit: mean ${d.mean.toFixed(3)}, far ${(d.farShare * 100).toFixed(3)} %`);
      // Stone & shadow paints its shadows as soft fields: the shade gives them back to the level. An
      // engraving's hatched shadows come back as the wash they average to.
      const engraved = look === 'print';
      expect(d.mean).toBeLessThan(engraved ? 1 : 0.2);
      expect(d.farShare).toBeLessThan(engraved ? 0.015 : 0.0005);
    });

    it(`${look}: lit, it draws no shadow that falls one way: in daylight the map is as it was drawn, without its shade`, async () => {
      const floor = floorOf(look);
      const camera = whole(floor);
      const day: Lit = { ambient: 1, lights: [] };
      const now = shoot(renderer, floor, day, camera);
      await save(now, camera, `${look}-3-daylight`);
      const bare = shoot(renderer, floor, { ...day, shade: false }, camera);
      const d = difference(bare, now);
      expect(d.mean).toBe(0);
      expect(d.farShare).toBe(0);
    });

    it(`${look}: dimmed with a torch, the torch's shadows take the baked ones' place`, async () => {
      const floor = floorOf(look);
      const { thing, lamp } = standingThing(floor.model);
      const torch = torchAt(floor, 'torch', lamp(-2.4));
      const dim: Lit = { ambient: 0.12, lights: [torch] };
      const camera = whole(floor);
      await save(shoot(renderer, floor, dim, camera), camera, `${look}-4-dim-torch`);
      const near = closeUp(floor, thing);
      const now = shoot(renderer, floor, dim, near);
      await save(now, near, `${look}-5-dim-torch-close`);
      await save(shoot(renderer, floor, { ...dim, baked: true }, near), near, `${look}-5b-dim-torch-close-before`);
      const lamps: Lit = { ambient: 0.12, lights: [torch, torchAt(floor, 'second', lamp(-0.5))] };
      await save(shoot(renderer, floor, lamps, near), near, `${look}-6-two-lamps-close`);
      await save(shoot(renderer, floor, { ambient: 1, lights: [] }, near), near, `${look}-7-daylight-close`);
      await save(shoot(renderer, floor, null, near, true), near, `${look}-8-baked-close`);
    });

    it(`${look}: dimmed with a torch, the shade adds nothing: every shadow there is the torch's`, async () => {
      const floor = floorOf(look);
      const { thing, lamp } = standingThing(floor.model);
      const torch = torchAt(floor, 'torch', lamp(-2.4));
      const near = closeUp(floor, thing, 80, 6, 4);
      const lit: Lit = { ambient: 0.12, lights: [torch] };
      const d = difference(shoot(renderer, floor, { ...lit, shade: false }, near), shoot(renderer, floor, lit, near));
      expect(d.mean).toBe(0);
    });
  }

  it('barrow: an overgrown room\'s plants cast their small shadows from a torch, as stones do', async () => {
    const floor = shadedFloor({ seed: 12, tags: ['overgrown', 'wet'], floors: 1 }, 'moss', PX_PER_CELL);
    floors.set('moss', floor);
    const { thing, lamp } = standingThing(floor.model);
    const near = closeUp(floor, thing);
    const torch = torchAt(floor, 'torch', lamp(-2.4));
    await save(shoot(renderer, floor, null, near, true), near, 'moss-1-baked-close');
    await save(shoot(renderer, floor, { ambient: 1, lights: [] }, near), near, 'moss-2-daylight-close');
    await save(shoot(renderer, floor, { ambient: 0.12, lights: [torch] }, near), near, 'moss-3-dim-torch-close');
    const whole = { ...near, scale: Math.min(1600 / floor.layout.widthPx, 1200 / floor.layout.heightPx), x: 0, y: 0 };
    const today = shoot(renderer, floor, null, { ...whole, width: Math.round(floor.layout.widthPx * whole.scale), height: Math.round(floor.layout.heightPx * whole.scale) }, true);
    const shaded = shoot(renderer, floor, null, { ...whole, width: Math.round(floor.layout.widthPx * whole.scale), height: Math.round(floor.layout.heightPx * whole.scale) });
    expect(difference(today, shaded).mean).toBeLessThan(0.3);
  });
});
