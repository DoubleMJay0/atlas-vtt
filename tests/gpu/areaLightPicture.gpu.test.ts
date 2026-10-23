import { CanvasSource, Container, Matrix, RenderTexture, Sprite, Texture } from 'pixi.js';
import { commands } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { sealTolerance, worldTexel } from '../../src/app/lighting/lightingConstants';
import { sealWalls } from '../../src/app/lighting/sealWalls';
import type { UnitScale } from '../../src/app/lighting/lightingUnits';
import type { LightEmission } from '../../src/app/types/lightingTypes';
import type { Point } from '../../src/app/types/visionTypes';
import type { WallSegment } from '../../src/app/types/wallTypes';
import { engineLight } from '../../src/app/vision/lightSources';
import { SEES_ALL } from '../../src/app/vision/sight';
import { LightingEngine } from '../../src/app/pixi/lighting/engine/LightingEngine';
import { createTestRenderer, readRgba } from '../../src/app/pixi/lighting/engine/__tests__/gpuTestUtils';

const MAP = 1024;
/** 5 ft cells of 50 px. */
const SCALE: UnitScale = { unitDistance: 5, cellSize: 50 };
const LAVA: LightEmission = { bright: 10, dim: 30, color: '#ff7a2a', intensity: 1, animation: 'none', kind: 'custom' };

/** A lava field that follows the cells, as the dungeon generator draws one. */
const LAVA_FIELD: Point[] = [
  { x: 250, y: 350 }, { x: 400, y: 350 }, { x: 400, y: 400 }, { x: 500, y: 400 }, { x: 500, y: 550 },
  { x: 450, y: 550 }, { x: 450, y: 650 }, { x: 300, y: 650 }, { x: 300, y: 550 }, { x: 250, y: 550 },
];

let id = 0;
function wall(x1: number, y1: number, x2: number, y2: number, extra: Partial<WallSegment> = {}): WallSegment {
  return { id: `w${id++}`, kind: 'wall', type: 'solid', p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, ...extra };
}

/** A room with the lava, a pillar beside it, and a second room behind a closed door. */
function dungeonWalls(): WallSegment[] {
  return [
    wall(100, 100, 700, 100), wall(700, 100, 700, 450), wall(700, 450, 700, 500, { type: 'door', closed: true }), wall(700, 500, 700, 900),
    wall(700, 900, 100, 900), wall(100, 900, 100, 100),
    wall(700, 100, 950, 100), wall(950, 100, 950, 900), wall(950, 900, 700, 900),
    // A pillar near the lava.
    wall(560, 450, 600, 450), wall(600, 450, 600, 490), wall(600, 490, 560, 490), wall(560, 490, 560, 450),
  ];
}

/** A stone floor with the lava painted on it. */
function mapCanvas(): OffscreenCanvas {
  const canvas = new OffscreenCanvas(MAP, MAP);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8a857c';
  ctx.fillRect(0, 0, MAP, MAP);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let x = 0; x <= MAP; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, MAP);
    ctx.moveTo(0, x);
    ctx.lineTo(MAP, x);
    ctx.stroke();
  }
  ctx.fillStyle = '#c2410c';
  ctx.beginPath();
  LAVA_FIELD.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  return canvas;
}

async function savePng(pixels: Uint8ClampedArray, size: number, name: string): Promise<void> {
  const canvas = new OffscreenCanvas(size, size);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), size, size), 0, 0);
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  await commands.writeFile(`out/area-lights/${name}.png`, btoa(binary), 'base64');
}

describe('an area light over lava', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  it('lights its room evenly from the whole lava and nothing past the walls', async () => {
    const renderer = await createTestRenderer(MAP);
    cleanup.push(() => renderer.destroy());
    const engine = new LightingEngine(renderer);
    cleanup.push(() => engine.destroy());
    const bounds = { width: MAP, height: MAP };
    const walls = sealWalls(dungeonWalls(), sealTolerance(worldTexel(bounds)));
    const light = engineLight({ key: 'lava', x: 375, y: 500, emission: LAVA, area: LAVA_FIELD }, SCALE);
    const map = Texture.from(new CanvasSource({ resource: mapCanvas() as unknown as HTMLCanvasElement }));
    cleanup.push(() => map.destroy(true));
    engine.setEnabled(true);
    engine.setMode('player');
    engine.update({ bounds, albedo: map, walls, lights: [light], sight: SEES_ALL, sightRadius: 20, ambient: 0 });
    engine.flush();
    const stage = new Container();
    const floor = new Sprite(map);
    stage.addChild(floor, engine.layer);
    engine.setView(new Matrix(), 1);
    const target = RenderTexture.create({ width: MAP, height: MAP });
    renderer.render({ container: stage, target, clear: true });
    const pixels = readRgba(renderer, target);
    stage.removeChild(engine.layer);
    stage.destroy({ children: true });
    target.destroy(true);
    await savePng(pixels, MAP, 'lava-room');
    const at = (x: number, y: number): number => pixels[(y * MAP + x) * 4]! + pixels[(y * MAP + x) * 4 + 1]! + pixels[(y * MAP + x) * 4 + 2]!;
    // The lava itself, the floor beside it and the floor in the room's far corner; the room behind the door.
    expect(at(375, 500)).toBeGreaterThan(200);
    expect(at(550, 500)).toBeGreaterThan(100);
    let leaked = 0;
    for (let y = 104; y < 896; y++) for (let x = 704; x < 946; x++) leaked += at(x, y);
    expect(leaked).toBe(0);
  });
});
