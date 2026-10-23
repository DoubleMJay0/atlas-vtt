import { CanvasSource, Container, Matrix, RenderTexture, Sprite, Texture, type WebGLRenderer } from 'pixi.js';
import { generateDungeon } from '../../src/app/dungeons/generate';
import type { DungeonModel, DungeonRequest } from '../../src/app/dungeons/model';
import { mapLayout, type MapLayout } from '../../src/app/dungeons/render/layoutSize';
import { renderMap } from '../../src/app/dungeons/render/renderMap';
import { renderRelief } from '../../src/app/dungeons/render/shading/reliefImage';
import { renderShade } from '../../src/app/dungeons/render/shading/shadeImage';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { dungeonScene } from '../../src/app/dungeons/scene/toScene';
import { DEFAULT_VIEW, type DungeonView } from '../../src/app/dungeons/style';
import { dungeonStyle, type DungeonStyleId } from '../../src/app/dungeons/styleCatalog';
import { sealTolerance, worldTexel } from '../../src/app/lighting/lightingConstants';
import { wallList } from '../../src/app/vision/wallList';
import type { UnitScale } from '../../src/app/lighting/lightingUnits';
import { sealWalls } from '../../src/app/lighting/sealWalls';
import { LightingEngine } from '../../src/app/pixi/lighting/engine/LightingEngine';
import { ReliefMap } from '../../src/app/pixi/lighting/engine/ReliefMap';
import { ShadeLayer } from '../../src/app/pixi/lighting/engine/ShadeLayer';
import type { EngineLight } from '../../src/app/pixi/lighting/engine/types';
import { readRgba } from '../../src/app/pixi/lighting/engine/__tests__/gpuTestUtils';
import type { LightEmission } from '../../src/app/types/lightingTypes';
import type { ShadeHatch } from '../../src/app/lighting/shadeHatch';
import type { Point } from '../../src/app/types/visionTypes';
import type { WallSegment } from '../../src/app/types/wallTypes';
import { activeLights, engineLight } from '../../src/app/vision/lightSources';
import { SEES_ALL } from '../../src/app/vision/sight';

/** A generated dungeon floor made into what a scene shows: its map with and without its cast shadows, its relief and shade, walls and lava lights. */
export interface ShadedFloor {
  model: DungeonModel;
  layout: MapLayout;
  /** The map as every picture of a dungeon paints it, shadows baked in. */
  baked: Texture;
  /** The scene's map: drawn without the shadows its shade holds. */
  bare: Texture;
  shade: Texture | null;
  hatch: ShadeHatch | null;
  relief: ReliefMap;
  walls: WallSegment[];
  /** The lights the scene brings (lava, acid). */
  lights: EngineLight[];
  scale: UnitScale;
  destroy(): void;
}

function canvasTexture(canvas: OffscreenCanvas): Texture {
  return Texture.from(new CanvasSource({ resource: canvas as unknown as HTMLCanvasElement }));
}

function pixelsCanvas({ width, height, data }: { width: number; height: number; data: Uint8ClampedArray }): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return canvas;
}

export function shadedFloor(request: DungeonRequest, look: DungeonStyleId, pxPerCell: number, view: DungeonView = DEFAULT_VIEW): ShadedFloor {
  const model = generateDungeon(request);
  const style = dungeonStyle(look);
  const layout = mapLayout(model, pxPerCell, view);
  const draw = (castShadows: boolean): OffscreenCanvas => {
    const canvas = new OffscreenCanvas(layout.widthPx, layout.heightPx);
    renderMap(canvas.getContext('2d')!, model, style, view, { pxPerCell, castShadows });
    return canvas;
  };
  const baked = canvasTexture(draw(true));
  const bare = canvasTexture(draw(false));
  const shadePixels = renderShade(model, style, view, 0, pxPerCell);
  const shade = shadePixels && canvasTexture(pixelsCanvas(shadePixels.image));
  const hatch = shadePixels?.hatch ?? null;
  const reliefPixels = renderRelief(model, style, view, 0)!;
  const heights = new Uint8Array(reliefPixels.width * reliefPixels.height);
  for (let k = 0; k < heights.length; k++) heights[k] = reliefPixels.data[k * 4]!;
  const relief = new ReliefMap({ width: reliefPixels.width, height: reliefPixels.height, heights }, new Matrix(layout.widthPx, 0, 0, layout.heightPx, 0, 0));
  const image = { width: layout.widthPx, height: layout.heightPx };
  const unit = { unitType: 'ft' as const, ruleDistance: 5 };
  const parts = dungeonScene(model, style, view, { originCell: layout.originCell, pxPerCell }, image, unit)!;
  const walls = sealWalls(wallList(parts.scene.walls), sealTolerance(worldTexel(image)));
  const scale: UnitScale = { unitDistance: 5, cellSize: pxPerCell };
  const lights = activeLights(parts.scene.lights, {}).map((light) => engineLight(light, scale));
  return {
    model, layout, baked, bare, shade, hatch, relief, walls, lights, scale,
    destroy: () => {
      baked.destroy(true);
      bare.destroy(true);
      shade?.destroy(true);
      relief.destroy();
    },
  };
}

const TORCH: LightEmission = { bright: 20, dim: 40, color: '#ffb35c', intensity: 1, animation: 'none', kind: 'torch' };

/** A torch at `cell` (cell space of the dungeon), in world pixels of `floor`. */
export function torchAt(floor: ShadedFloor, key: string, cell: Point, emission: LightEmission = TORCH): EngineLight {
  const { originCell, pxPerCell } = floor.layout;
  return engineLight({ key, x: (cell.x - originCell.x) * pxPerCell, y: (cell.y - originCell.y) * pxPerCell, emission }, floor.scale);
}

/** Where something that stands and casts a shadow lies on the entry floor, in cells (a statue or a pillar, else a column), and open floor near it for a lamp. */
export function standingThing(model: DungeonModel, distance = 1.8): { thing: Point; lamp: (turn: number) => Point } {
  const dungeon = visibleDungeon(model, DEFAULT_VIEW, 0);
  const middle = (cells: readonly Point[]): Point => {
    const xs = cells.map((c) => c.x), ys = cells.map((c) => c.y);
    return { x: (Math.min(...xs) + Math.max(...xs) + 1) / 2, y: (Math.min(...ys) + Math.max(...ys) + 1) / 2 };
  };
  const candidates: Point[] = [
    ...dungeon.floor.terrain.filter((piece) => piece.kind === 'statue' || piece.kind === 'pillar' || piece.kind === 'obelisk').map((piece) => middle(piece.cells)),
    ...dungeon.floor.props.filter((prop) => prop.kind === 'statue').map((prop) => ({ x: prop.x, y: prop.y })),
    ...dungeon.floor.columns.filter((column) => !column.shattered).map((column) => ({ x: column.x, y: column.y })),
  ];
  const open = (p: Point): boolean => dungeon.field.distance(p.x, p.y) < -0.6;
  // The first thing with open floor all round it at the lamp's distance.
  const thing = candidates.find((c) => Array.from({ length: 8 }, (_, k) => k * Math.PI / 4).filter((a) => open({ x: c.x + Math.cos(a) * distance, y: c.y + Math.sin(a) * distance })).length >= 5) ?? candidates[0]!;
  const lamp = (turn: number): Point => {
    for (let k = 0; k < 16; k++) {
      const angle = turn + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8;
      const at = { x: thing.x + Math.cos(angle) * distance, y: thing.y + Math.sin(angle) * distance };
      if (open(at)) return at;
    }
    return { x: thing.x + distance, y: thing.y };
  };
  return { thing, lamp };
}

/** How a picture is lit: unlit (no lighting at all), or by the engine at `ambient` with `lights`, with or without the floor's relief and shade. */
export interface Lit {
  ambient: number;
  lights: EngineLight[];
  /** Without relief and shade, on the baked map: how a scene lit before this showed. */
  baked?: boolean;
  /** False leaves the shade out (the map still drawn without its shadows), to see what the shade gives. */
  shade?: boolean;
}

/**
 * Renders the floor through a camera (`scale`, the world point at the picture's corner) into a
 * `width` × `height` picture: the map, its shade multiplied over it, and the lighting's layer when lit.
 */
export function shoot(renderer: WebGLRenderer, floor: ShadedFloor, lit: Lit | null, camera: { scale: number; x: number; y: number; width: number; height: number }, unlitBaked = false): Uint8ClampedArray {
  const stage = new Container();
  const world = new Container();
  const baked = unlitBaked || lit?.baked === true;
  world.addChild(new Sprite(baked ? floor.baked : floor.bare));
  const shade = new ShadeLayer(true);
  if (!baked && floor.shade && lit?.shade !== false) {
    shade.setImage({ texture: floor.shade, uvToWorld: new Matrix(floor.layout.widthPx, 0, 0, floor.layout.heightPx, 0, 0), hatch: floor.hatch });
    world.addChild(shade.view);
  }
  let engine: LightingEngine | null = null;
  if (lit) {
    engine = new LightingEngine(renderer);
    engine.setShade(shade);
    engine.setEnabled(true);
    engine.setMode('player');
    engine.update({
      bounds: { width: floor.layout.widthPx, height: floor.layout.heightPx },
      albedo: baked ? floor.baked : floor.bare,
      walls: floor.walls,
      lights: [...floor.lights, ...lit.lights],
      sight: SEES_ALL,
      sightRadius: floor.layout.pxPerCell / 2,
      ambient: lit.ambient,
      relief: baked ? null : floor.relief.relief,
    });
    engine.flush();
    engine.setView(new Matrix(camera.scale, 0, 0, camera.scale, -camera.x * camera.scale, -camera.y * camera.scale).invert(), camera.scale);
    world.addChild(engine.layer);
  }
  world.scale.set(camera.scale);
  world.position.set(-camera.x * camera.scale, -camera.y * camera.scale);
  stage.addChild(world);
  const target = RenderTexture.create({ width: camera.width, height: camera.height });
  renderer.render({ container: stage, target, clear: true, clearColor: [0, 0, 0, 1] });
  const pixels = readRgba(renderer, target);
  if (engine) world.removeChild(engine.layer);
  world.removeChild(shade.view);
  engine?.destroy();
  shade.destroy();
  stage.destroy({ children: true });
  target.destroy(true);
  return pixels;
}
