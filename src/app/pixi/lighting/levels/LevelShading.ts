import { Texture } from 'pixi.js';
import { sameStretch, type MapStretch } from '../../../grid/mapStretch';
import { getDomHost } from '../../../host/dom';
import type { LevelShading as ShadingPaths } from '../../../levels/levelShading';
import type { ShadeHatch } from '../../../lighting/shadeHatch';
import { imagePlacement, ReliefMap, type EngineRelief, type ReliefImage } from '../engine/ReliefMap';
import { ShadeLayer } from '../engine/ShadeLayer';

/** An image's pixels, unpremultiplied RGBA, rows top first, and how it is hatched where it says so. */
export interface ShadingPixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** How the image is cut where its map is an engraving (`ShadeHatch`); null where it says nothing. */
  hatch: ShadeHatch | null;
}

export interface LevelShadingDeps {
  /** The renderer runs WebGL: the shade can follow the scene's light (`ShadeLayer`). */
  gpu: boolean;
  /** Reads a relief or shade image of the vault; rejects where it cannot. */
  read: (path: string) => Promise<ShadingPixels>;
  requestRender: () => void;
  /** An image arrived: the owner follows again (`follow`), which shows it. */
  onRead: () => void;
  /** The relief changed: the lighting takes the new one (`relief()`) before the old one goes. */
  onReliefChange: () => void;
}

/** Where a level's map lies, as the shading follows it: its image's size, and how it is drawn now and as the scene has it. */
export interface ShadedMap {
  size: { width: number; height: number };
  /** How the map image draws it now (an alignment's preview too): the shade lies there. */
  drawn: MapStretch;
  /** How the scene places it, as the lighting's walls are: the relief lies there. */
  placed: MapStretch;
}

interface Read<T> {
  path: string;
  value: T | null;
}

/** Which image lies where: its path, its map's size and stretch. */
interface Placement {
  path: string;
  stretch: MapStretch;
  width: number;
  height: number;
}

function samePlacement(placed: Placement | null, path: string, size: ShadedMap['size'], stretch: MapStretch): boolean {
  return placed?.path === path && placed.width === size.width && placed.height === size.height && sameStretch(placed.stretch, stretch);
}

/** A canvas holding `pixels`, for a texture: PIXI premultiplies a canvas's pixels as it uploads them. */
function shadeCanvas({ width, height, data }: ShadingPixels): HTMLCanvasElement {
  const canvas = getDomHost().createCanvas(undefined, { width, height });
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return canvas;
}

/** The relief's heights: the red of each pixel. */
function reliefOf({ width, height, data }: ShadingPixels): ReliefImage {
  const heights = new Uint8Array(width * height);
  for (let k = 0; k < heights.length; k++) heights[k] = data[k * 4]!;
  return { width, height, heights };
}

/**
 * What lights one level's map besides its image (`levelShading`), on the GPU: its shade, drawn
 * over the map beneath everything on it (`layer`), and its relief, which the lighting casts every
 * light's shadows from (`relief()`). It reads the images it is asked for and places them on the
 * map; the owner says what the level holds and where its map lies (`follow`), the view's own
 * level (`ViewShading`) or a level below seen through an opening (`BelowLevel`).
 */
export class LevelShading {
  readonly layer: ShadeLayer;
  private shadeRead: Read<ShadingPixels> | null = null;
  private reliefRead: Read<ReliefImage> | null = null;
  private shadeTexture: Texture | null = null;
  private shadePlaced: Placement | null = null;
  private reliefMap: (Placement & { map: ReliefMap }) | null = null;
  private destroyed = false;

  constructor(private readonly deps: LevelShadingDeps) {
    this.layer = new ShadeLayer(deps.gpu);
  }

  /** The level's relief as the lighting reads it; null while it has none or it is not read yet. */
  relief(): EngineRelief | null {
    return this.reliefMap?.map.relief ?? null;
  }

  /** Brings the shade and the relief to `shading` on `map`; null for either, none (the level loads, or shows another's image). */
  follow(shading: ShadingPaths, map: ShadedMap | null): void {
    if (this.destroyed) return;
    this.read('shade', shading.shade);
    this.read('relief', shading.relief);
    this.showShade(map ? shading.shade : null, map);
    this.placeRelief(map ? shading.relief : null, map);
  }

  destroy(): void {
    this.destroyed = true;
    this.layer.setImage(null);
    this.layer.destroy();
    this.shadeTexture?.destroy(true);
    this.reliefMap?.map.destroy();
    this.reliefMap = null;
  }

  private read(kind: 'shade' | 'relief', path: string | null): void {
    const current = kind === 'shade' ? this.shadeRead : this.reliefRead;
    if (current?.path === path) return;
    if (kind === 'shade') this.shadeRead = path ? { path, value: null } : null;
    else this.reliefRead = path ? { path, value: null } : null;
    if (!path) return;
    this.deps.read(path).then(
      (pixels) => {
        if (this.destroyed) return;
        if (kind === 'shade' && this.shadeRead?.path === path) this.shadeRead = { path, value: pixels };
        if (kind === 'relief' && this.reliefRead?.path === path) this.reliefRead = { path, value: reliefOf(pixels) };
        this.deps.onRead();
      },
      (error: unknown) => console.warn(`[Atlas] The ${kind} image ${path} could not be read:`, error),
    );
  }

  private showShade(path: string | null, map: ShadedMap | null): void {
    const pixels = path && this.shadeRead?.path === path ? this.shadeRead.value : null;
    const placed = this.shadePlaced;
    if (!path || !pixels || !map) {
      if (!placed) return;
      this.shadePlaced = null;
      this.layer.setImage(null);
      this.shadeTexture?.destroy(true);
      this.shadeTexture = null;
      this.deps.requestRender();
      return;
    }
    const { size, drawn } = map;
    if (samePlacement(placed, path, size, drawn)) return;
    const previous = placed?.path === path ? null : this.shadeTexture;
    if (previous || !this.shadeTexture) this.shadeTexture = Texture.from(shadeCanvas(pixels));
    // The new image is set before the old texture goes: nothing destroyed stays bound.
    this.layer.setImage({ texture: this.shadeTexture, uvToWorld: imagePlacement(size, drawn), hatch: pixels.hatch });
    previous?.destroy(true);
    this.shadePlaced = { path, stretch: drawn, ...size };
    this.deps.requestRender();
  }

  private placeRelief(path: string | null, map: ShadedMap | null): void {
    const image = path && this.reliefRead?.path === path ? this.reliefRead.value : null;
    const placed = this.reliefMap;
    if (!path || !image || !map) {
      if (!placed) return;
      this.reliefMap = null;
    } else {
      if (samePlacement(placed, path, map.size, map.placed)) return;
      this.reliefMap = { map: new ReliefMap(image, imagePlacement(map.size, map.placed)), path, stretch: map.placed, ...map.size };
    }
    // The lighting takes the new relief at once, and lets go of the old one before it goes.
    this.deps.onReliefChange();
    placed?.map.destroy();
  }
}
