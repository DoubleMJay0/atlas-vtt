/// <reference types="vite/client" />
import '../setup/obsidianDom';
import { Matrix, Texture, type TextureSource, type WebGLRenderer } from 'pixi.js';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { generateDungeon } from '../../src/app/dungeons/generate';
import { mapLayout, suggestedPxPerCell } from '../../src/app/dungeons/render/layoutSize';
import { renderRelief, type RasterImage } from '../../src/app/dungeons/render/shading/reliefImage';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { dungeonScene } from '../../src/app/dungeons/scene/toScene';
import { DEFAULT_VIEW } from '../../src/app/dungeons/style';
import { dungeonStyle } from '../../src/app/dungeons/styleCatalog';
import { LEVEL_HEIGHT } from '../../src/app/levels/levelEdits';
import { holdTokens } from '../../src/app/lighting/sightOnDrop';
import { LIGHTING_QUALITY, type LightingQualityLevel } from '../../src/app/lighting/lightingQuality';
import { ReliefMap } from '../../src/app/pixi/lighting/engine/ReliefMap';
import { ShadeLayer } from '../../src/app/pixi/lighting/engine/ShadeLayer';
import { createViewLiquids } from '../../src/app/pixi/liquids/viewLiquids';
import type { TokenEntity } from '../../src/app/types';
import type { LightEmission, LightSource } from '../../src/app/types/lightingTypes';
import type { LevelSurface, SceneLevel } from '../../src/app/types/sceneLevelTypes';
import { profileCpu } from '../helpers/cpuProfile';
import { openLevelsView, type FakeMap, type LevelsView } from '../helpers/levelsView';

vi.mock('events', async () => import('eventemitter3'));

/**
 * What a generated dungeon of three floors costs at runtime, on a Retina-sized canvas, as Fabian
 * plays one: the entry floor viewed, the floors below seen through its openings, lava, water and
 * plants, relief on every floor, torches in the rooms and a vision token. Printed, nothing timed is
 * asserted: `VITE_QUALITY` picks a level, `VITE_PROFILE=idle|drag|torch` prints a CPU profile, `VITE_STEADY` keeps the
 * torches from flickering and `VITE_NO_RELIEF` leaves the viewed floor's relief out.
 */

const [WIDTH, HEIGHT, RESOLUTION] = [1440, 900, 2];
const BYTES: Record<string, number> = { rgba8unorm: 4, bgra8unorm: 4, rgba16float: 8, rgba32float: 16, r8unorm: 1, r16float: 2, r32float: 4, rg16float: 4, rg8unorm: 2 };
const TORCH: LightEmission = { bright: 20, dim: 40, color: '#ff9a3c', intensity: 1, animation: import.meta.env.VITE_STEADY ? 'none' : 'torch', kind: 'torch', sourceRadius: 2 };

function textureMb(renderer: WebGLRenderer): number {
  const managed = (renderer.texture as unknown as { managedTextures: TextureSource[] }).managedTextures;
  return managed.filter((source) => !!source).reduce((sum, source) => sum + source.pixelWidth * source.pixelHeight * (BYTES[source.format] ?? 4) * (source.antialias ? 4 : 1), 0) / 1e6;
}

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? NaN;
const round = (value: number): number => Math.round(value * 100) / 100;

interface Built {
  scene: NonNullable<ReturnType<typeof dungeonScene>>;
  levels: SceneLevel[];
  maps: Record<string, FakeMap>;
  reliefs: Map<string, RasterImage>;
  width: number;
  height: number;
  pxPerCell: number;
  relief: ReliefMap;
  viewed: string;
  /** Where the camera looks: the entry floor's opening. */
  look: { x: number; y: number };
  hero: { x: number; y: number };
  torches: Record<string, LightSource>;
}

function middle(polygon: readonly { x: number; y: number }[]): { x: number; y: number } {
  return { x: polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length, y: polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length };
}

/** A generated dungeon of three floors at the scene's own cell size; seed 4 opens its entry floor and the one below onto the floors under them. */
function dungeon(): Built {
  const model = generateDungeon({ seed: 4, tags: ['lava', 'overgrown', 'wet'], floors: 3 });
  const style = dungeonStyle('parchment');
  const pxPerCell = suggestedPxPerCell(model);
  const layout = mapLayout(model, pxPerCell, DEFAULT_VIEW);
  const image = { width: layout.widthPx, height: layout.heightPx };
  const scene = dungeonScene(model, style, DEFAULT_VIEW, { originCell: layout.originCell, pxPerCell }, image, { unitType: 'ft', ruleDistance: 5 })!;
  const ids = scene.levelIds!;
  const maps: Record<string, FakeMap> = {};
  const reliefs = new Map<string, RasterImage>();
  const levels = ids.map((id, floor): SceneLevel => {
    maps[`floor${floor}.png`] = { texture: Texture.WHITE, width: image.width, height: image.height };
    reliefs.set(`floor${floor}-relief.png`, renderRelief(model, style, DEFAULT_VIEW, floor)!);
    return { id, name: `Floor ${floor}`, elevation: { bottom: -floor * LEVEL_HEIGHT, top: (1 - floor) * LEVEL_HEIGHT }, background: `floor${floor}.png`, relief: `floor${floor}-relief.png` };
  }).reverse();
  const own = reliefs.get('floor0-relief.png')!;
  const heights = new Uint8Array(own.width * own.height);
  for (let k = 0; k < heights.length; k++) heights[k] = own.data[k * 4]!;
  const relief = new ReliefMap({ width: own.width, height: own.height, heights }, new Matrix(image.width, 0, 0, image.height, 0, 0));
  const opening = Object.values(scene.scene.levelSurfaces ?? {}).find((surface) => surface.level === ids[0] && surface.open)!;
  const look = middle(opening.polygon);
  const world = (r: { x: number; y: number; w: number; h: number }): { x: number; y: number } => ({ x: (r.x + r.w / 2 + 0.3 - layout.originCell.x) * pxPerCell, y: (r.y + r.h / 2 + 0.3 - layout.originCell.y) * pxPerCell });
  // The rooms nearest the opening: the hero stands in the first, torches burn in the others.
  const rooms = visibleDungeon(model, DEFAULT_VIEW, 0).rooms.filter((room) => room.w >= 3 && room.h >= 3)
    .sort((a, b) => Math.hypot(world(a).x - look.x, world(a).y - look.y) - Math.hypot(world(b).x - look.x, world(b).y - look.y));
  const hero = world(rooms[0]!);
  const torches = Object.fromEntries(rooms.slice(1, 7).map((room, i): [string, LightSource] => [`torch${i}`, { id: `torch${i}`, kind: 'light', levels: [ids[0]!], ...world(room), emission: TORCH }]));
  return { scene, levels, maps, reliefs, ...image, pxPerCell, relief, viewed: ids[0]!, look, hero, torches };
}

interface Measured { cpu: number; cpuMax: number; frame: number }

/** Every frame the stage rendered, and every picture of a level below drawn for one. */
interface Counts { stage: number; below: number }

interface Opened {
  level: LightingQualityLevel;
  view: LevelsView;
  frame: () => void;
  counts: Counts;
  gl: WebGL2RenderingContext;
  /** Draws the composite on every pixel of the canvas (true) or at the quality's pixel ratio (false). */
  fullRatio: (on: boolean) => void;
  destroy: () => void;
}

describe('the cost of a generated dungeon of three floors at runtime (printed)', () => {
  const built = dungeon();
  afterAll(() => built.relief.destroy());

  /** The view of the entry floor; with `openings` false the floors below are never seen (no opening on any floor). */
  async function open(level: LightingQualityLevel, openings: boolean): Promise<Opened> {
    const shade = new ShadeLayer(true);
    let quality = LIGHTING_QUALITY[level];
    const listeners = new Set<() => void>();
    const view = await openLevelsView({
      map: Math.max(built.width, built.height), pane: WIDTH, paneHeight: HEIGHT, resolution: RESOLUTION,
      levels: built.levels, maps: built.maps, viewedLevel: built.viewed,
      qualitySource: { current: () => quality, onChange: (listener) => { listeners.add(listener); return () => listeners.delete(listener); } },
      shading: { relief: () => (import.meta.env.VITE_NO_RELIEF ? null : built.relief.relief), layer: shade },
      readShading: (path) => {
        const pixels = built.reliefs.get(path);
        return pixels ? Promise.resolve({ ...pixels, hatch: null }) : Promise.reject(new Error(`No image ${path}`));
      },
    });
    const { scene } = built;
    const hero = { id: 'hero', kind: 'token', imagePath: '', x: built.hero.x, y: built.hero.y, level: built.viewed, vision: { enabled: true } } as TokenEntity;
    const surfaces: Record<string, LevelSurface> = openings ? scene.scene.levelSurfaces ?? {} : {};
    view.store.setState({
      mapLoaded: true, isMapLoading: false, levels: built.levels, viewedLevel: built.viewed,
      grid: { ...view.store.getState().grid, ...scene.scene.grid },
      objects: {
        ...view.store.getState().objects,
        walls: scene.scene.walls ?? {}, lights: { ...scene.scene.lights, ...built.torches }, tokens: { hero },
        mapFeatures: scene.scene.mapFeatures ?? {}, liquids: scene.scene.liquids ?? {},
        levelSurfaces: surfaces, levelLinks: scene.scene.levelLinks ?? {},
      },
    });
    view.store.getState().setSceneLighting({ enabled: true, ambient: 0.05 });
    const liquids = createViewLiquids(view.app, view.viewport, view.store, { current: () => LIGHTING_QUALITY[level], onChange: () => () => undefined });
    liquids.container.zIndex = -1;
    view.viewport.addChild(liquids.container);
    liquids.setMode('play');
    liquids.buildPending();
    // A cell about 70 points on the screen, the opening in the middle.
    const zoom = 70 / built.pxPerCell;
    view.viewport.scale.set(zoom);
    view.viewport.position.set(WIDTH / 2 - built.look.x * zoom, HEIGHT / 2 - built.look.y * zoom);
    await view.settle();
    const renderer = view.app.renderer as WebGLRenderer;
    const counts: Counts = { stage: 0, below: 0 };
    const render = renderer.render.bind(renderer);
    renderer.render = ((...args: Parameters<typeof render>) => {
      const container = (args[0] as { container?: { label?: string } }).container;
      if (container === view.app.stage) counts.stage++;
      else if (container?.label === 'level-below') counts.below++;
      return render(...args);
    }) as typeof renderer.render;
    let time = performance.now();
    return {
      level, view, gl: renderer.gl, counts,
      fullRatio: (on) => {
        quality = { ...LIGHTING_QUALITY[level] };
        if (on) delete quality.compositePixelRatio;
        for (const listener of listeners) listener();
      },
      frame: () => { view.app.ticker.update(time = Math.max(time + 16, performance.now())); },
      destroy: () => { liquids.destroy(); view.dispose(); shade.destroy(); },
    };
  }

  /** Waits until the graphics device has done everything asked of it: a pixel read back. */
  function settleGpu(gl: WebGL2RenderingContext): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  /**
   * CPU of `step` and its display frame (median and worst), and the wall time until the graphics
   * device finished it (`frame`: CPU and GPU together, median), `count` times. Timer queries are no
   * use here: on ANGLE's Metal backend one spans the gaps between the command buffers a paced
   * engine commits.
   */
  async function measure(ctx: Opened, count: number, step: (i: number) => void): Promise<Measured> {
    const cpu: number[] = [];
    const frame: number[] = [];
    settleGpu(ctx.gl);
    for (let i = 0; i < count; i++) {
      const started = performance.now();
      step(i);
      ctx.frame();
      cpu.push(performance.now() - started);
      settleGpu(ctx.gl);
      frame.push(performance.now() - started);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return { cpu: round(median(cpu)), cpuMax: round(Math.max(...cpu)), frame: round(median(frame)) };
  }

  /** Stage renders and pictures of levels below a second at rest, and how many ms of each second the frames take until the graphics device is done, in real time. */
  async function idleSecond(ctx: Opened): Promise<{ renders: number; belowDraws: number; busyMsPerSecond: number }> {
    const before = { ...ctx.counts };
    let busy = 0;
    settleGpu(ctx.gl);
    const end = performance.now() + 2000;
    while (performance.now() < end) {
      const started = performance.now();
      ctx.frame();
      settleGpu(ctx.gl);
      busy += performance.now() - started;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return { renders: (ctx.counts.stage - before.stage) / 2, belowDraws: (ctx.counts.below - before.below) / 2, busyMsPerSecond: round(busy / 2) };
  }

  /**
   * Time (ms) one stage render takes the graphics device at full pace, as the scheduler draws it
   * (the levels below prepared first): 30 renders back to back, then a pixel read back. At rest,
   * moving (a camera a pixel off each render draws the levels below anew, as a zoom or pan does),
   * and with parts of the stage hidden.
   */
  async function throughput(ctx: Opened): Promise<Record<string, number>> {
    const { view, gl } = ctx;
    const lighting = view.viewport.children.find((child) => child.label === 'lighting')!;
    const liquids = view.viewport.children.find((child) => child.label === 'liquids')!;
    const time = async (setup: () => void): Promise<number> => {
      const runs: number[] = [];
      for (let run = 0; run < 5; run++) {
        settleGpu(gl);
        const started = performance.now();
        for (let i = 0; i < 30; i++) {
          setup();
          view.controller.renderer.prepareBelow?.();
          view.app.renderer.render({ container: view.app.stage });
        }
        settleGpu(gl);
        runs.push((performance.now() - started) / 30);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return round(median(runs));
    };
    const x0 = view.viewport.x;
    let nudge = 0;
    const moving = (): void => { view.viewport.x = x0 + (nudge++ % 2); };
    const out: Record<string, number> = {};
    out.atRest = await time(() => undefined);
    if (ctx.view.app.renderer.resolution > (LIGHTING_QUALITY[ctx.level].compositePixelRatio ?? Infinity)) {
      // The composite on every pixel against the quality's ratio, in turn, as the device's clocks drift:
      // back to back (the device's throughput) and one render at a time (what a frame waits for).
      const single = async (): Promise<number> => {
        const runs: number[] = [];
        for (let i = 0; i < 20; i++) {
          settleGpu(gl);
          const started = performance.now();
          view.controller.renderer.prepareBelow?.();
          view.app.renderer.render({ container: view.app.stage });
          settleGpu(gl);
          runs.push(performance.now() - started);
        }
        return median(runs);
      };
      const samples: Record<string, number[]> = { atRestEveryPixel: [], atRestReduced: [], frameEveryPixel: [], frameReduced: [] };
      for (let round = 0; round < 3; round++) {
        ctx.fullRatio(true);
        samples.atRestEveryPixel!.push(await time(() => undefined));
        samples.frameEveryPixel!.push(await single());
        ctx.fullRatio(false);
        samples.atRestReduced!.push(await time(() => undefined));
        samples.frameReduced!.push(await single());
      }
      for (const [name, values] of Object.entries(samples)) out[name] = round(median(values));
    }
    out.moving = await time(moving);
    liquids.visible = false;
    out.movingNoLiquids = await time(moving);
    lighting.visible = false;
    out.movingMapAlone = await time(moving);
    lighting.visible = true;
    liquids.visible = true;
    view.viewport.x = x0;
    return out;
  }

  const levels = (import.meta.env.VITE_QUALITY ? [import.meta.env.VITE_QUALITY] : ['high', 'balanced', 'saver']) as LightingQualityLevel[];
  const cases = levels.flatMap((level) => [[level, true], [level, false]] as const);

  it.each(cases)('at %s quality, floors below seen: %s', async (level, openings) => {
    const ctx = await open(level, openings);
    try {
      const { view } = ctx;
      // The build settles: tiles, bounce, the levels below.
      for (let i = 0; i < 90; i++) {
        ctx.frame();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const memoryMb = round(textureMb(view.app.renderer as WebGLRenderer));
      const idle = await idleSecond(ctx);
      if (import.meta.env.VITE_PROFILE === 'idle') {
        const taken = await profileCpu(async () => { await idleSecond(ctx); }, 40);
        console.info(`idle profile, self:\n${taken.self.map(([n, ms]) => `${ms}\t${n}`).join('\n')}\ntotal:\n${taken.total.map(([n, ms]) => `${ms}\t${n}`).join('\n')}`);
      }
      const render = await throughput(ctx);
      const zoom0 = view.viewport.scale.x;
      const zoom = await measure(ctx, 30, (i) => { view.viewport.scale.set(zoom0 * (1 + 0.5 * Math.sin(i / 5))); });
      view.viewport.scale.set(zoom0);
      holdTokens(view.store, ['hero']);
      const cell = built.pxPerCell;
      const step = (i: number): void => { view.store.getState().setTokenPositions([{ id: 'hero', x: built.hero.x + (i % 20) * cell * 0.15, y: built.hero.y + Math.sin(i / 4) * cell * 0.3 }]); };
      const belowBefore = ctx.counts.below;
      const drag = await measure(ctx, 40, step);
      const belowPerStep = round((ctx.counts.below - belowBefore) / 40);
      const profile = async (name: string): Promise<void> => {
        if (import.meta.env.VITE_PROFILE !== name) return;
        const taken = await profileCpu(async () => { await measure(ctx, 40, (i) => step(i + 3)); }, 60);
        console.info(`${name} profile, self:\n${taken.self.map(([n, ms]) => `${ms}\t${n}`).join('\n')}\ntotal:\n${taken.total.map(([n, ms]) => `${ms}\t${n}`).join('\n')}`);
      };
      await profile('drag');
      // The hero takes up a torch: its light, reflection and relief shadows follow every step.
      view.store.getState().updateTokens([{ id: 'hero', changes: { light: TORCH } }]);
      await measure(ctx, 10, step);
      const torchDrag = await measure(ctx, 40, step);
      await profile('torch');
      holdTokens(view.store, []);
      const s = view.store.getState();
      const scene = { mapPx: `${built.width}×${built.height}`, pxPerCell: built.pxPerCell, walls: Object.keys(s.objects.walls).length, lights: Object.keys(s.objects.lights).length, liquids: Object.keys(s.objects.liquids ?? {}).length };
      console.info(`dungeon runtime cost at ${level}, floors below seen ${openings}: ${JSON.stringify({ ...scene, memoryMb, idle, render, zoom, drag, belowPerStep, torchDrag })}`);
      expect(drag.cpu).toBeGreaterThan(0);
    } finally {
      ctx.destroy();
    }
  });
});
