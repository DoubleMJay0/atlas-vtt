import { Texture, type Application } from 'pixi.js';
import type { App } from 'obsidian';
import { sameStretch, type MapStretch } from '../../grid/mapStretch';
import { viewedImagePlacement } from '../../levels/levelAlignment';
import { levelShading } from '../../levels/levelShading';
import { viewedLevelId } from '../../levels/sceneLevels';
import type { ViewAtlasStore } from '../../storeFactory';
import { MapController } from '../../MapController';
import type { MapImage } from '../mapImage/MapImage';
import { imagePlacement, ReliefMap, type EngineRelief, type ReliefImage } from '../lighting/engine/ReliefMap';
import { ShadeLayer } from '../lighting/engine/ShadeLayer';
import { MAP_LAYER_Z } from '../mapLayerOrder';
import { requestRender } from '../RenderScheduler';
import { usesCanvasRenderer } from '../utils/rendererType';
import { readShadingImage, shadeCanvas, type ShadingPixels } from './shadingImages';

export interface ViewShadingDeps {
  obsApp: App;
  app: Application;
  store: ViewAtlasStore;
  /** The view's map image, while it has one. */
  mapImage: () => MapImage | null;
  /** The relief changed: the lighting casts its lights' shadows from the new one (`relief()`). */
  onReliefChange: () => void;
}

/** An image of the viewed level read for its shading: what path it is, and its pixels once read (null: unreadable). */
interface Read<T> {
  path: string;
  value: T | null;
}

/**
 * What lights the level a view shows besides its map (`levelShading`): its shade, drawn over the
 * map beneath everything on it (`ShadeLayer`, `MAP_LAYER_Z.shade`), and its relief, which the
 * lighting casts every light's shadows from (`relief()`). Both are read from the vault when the
 * level shows and lie on its map as it is drawn: the shade as the map image draws it now (an
 * alignment's preview too), the relief as the scene has it, like the lighting's walls. Nothing
 * shows while the scene loads or the map image shows another level's.
 */
export class ViewShading {
  readonly layer: ShadeLayer;
  private readonly cleanups: Array<() => void> = [];
  private shadeRead: Read<ShadingPixels> | null = null;
  private reliefRead: Read<ReliefImage> | null = null;
  private shadeTexture: Texture | null = null;
  /** The shade as it is shown: its texture's path and where it lies. */
  private shadePlaced: { path: string; stretch: MapStretch; width: number; height: number } | null = null;
  private reliefMap: { map: ReliefMap; path: string; stretch: MapStretch; width: number; height: number } | null = null;
  private destroyed = false;

  constructor(private readonly deps: ViewShadingDeps) {
    this.layer = new ShadeLayer(!usesCanvasRenderer(deps.app.renderer));
    this.layer.view.zIndex = MAP_LAYER_Z.shade;
    this.cleanups.push(
      deps.store.subscribe(() => this.follow()),
      // A level's map image finished loading: the level shows now.
      MapController.onBackgroundLoaded(() => this.follow()),
    );
    this.follow();
  }

  /** The viewed level's relief as the lighting reads it; null while it has none or it is not read yet. */
  relief(): EngineRelief | null {
    return this.reliefMap?.map.relief ?? null;
  }

  /** Brings the shade and the relief to the level shown and its map as drawn; call it when the map image changes. */
  follow(): void {
    if (this.destroyed) return;
    const state = this.deps.store.getState();
    const mapImage = this.deps.mapImage();
    const shown = !state.isMapLoading && MapController.showsViewedLevel(mapImage, state) ? mapImage : null;
    const size = shown?.imageSize ?? null;
    const { relief, shade } = shown ? levelShading(state, viewedLevelId(state)) : { relief: null, shade: null };
    this.read('shade', shade);
    this.read('relief', relief);
    this.showShade(shade, size, shown?.mapStretch ?? null);
    this.placeRelief(relief, size, size ? viewedImagePlacement(state) : null);
  }

  destroy(): void {
    this.destroyed = true;
    for (const cleanup of this.cleanups) cleanup();
    this.layer.setImage(null);
    this.layer.destroy();
    this.shadeTexture?.destroy(true);
    this.reliefMap?.map.destroy();
    this.reliefMap = null;
  }

  /** Starts reading `path` for `kind` where it is not the one read or being read; null forgets it. */
  private read(kind: 'shade' | 'relief', path: string | null): void {
    const current = kind === 'shade' ? this.shadeRead : this.reliefRead;
    if (current?.path === path) return;
    if (kind === 'shade') this.shadeRead = path ? { path, value: null } : null;
    else this.reliefRead = path ? { path, value: null } : null;
    if (!path) return;
    readShadingImage(this.deps.obsApp, path).then(
      (pixels) => this.arrived(kind, path, pixels),
      (error: unknown) => console.warn(`[Atlas] The ${kind} image ${path} could not be read:`, error),
    );
  }

  private arrived(kind: 'shade' | 'relief', path: string, pixels: ShadingPixels): void {
    if (this.destroyed) return;
    if (kind === 'shade' && this.shadeRead?.path === path) this.shadeRead = { path, value: pixels };
    if (kind === 'relief' && this.reliefRead?.path === path) this.reliefRead = { path, value: reliefOf(pixels) };
    this.follow();
  }

  private showShade(path: string | null, size: { width: number; height: number } | null, stretch: MapStretch | null): void {
    const pixels = this.shadeRead?.path === path ? this.shadeRead?.value ?? null : null;
    const placed = this.shadePlaced;
    if (path && pixels && size && stretch && placed?.path === path && placed.width === size.width && placed.height === size.height && sameStretch(placed.stretch, stretch)) return;
    if (!path || !pixels || !size || !stretch) {
      if (!placed) return;
      this.shadePlaced = null;
      this.layer.setImage(null);
      this.shadeTexture?.destroy(true);
      this.shadeTexture = null;
      requestRender(this.deps.app);
      return;
    }
    if (placed?.path !== path || !this.shadeTexture) {
      const previous = this.shadeTexture;
      this.shadeTexture = Texture.from(shadeCanvas(pixels));
      this.layer.setImage({ texture: this.shadeTexture, uvToWorld: imagePlacement(size, stretch), hatch: pixels.hatch });
      previous?.destroy(true);
    } else {
      this.layer.setImage({ texture: this.shadeTexture, uvToWorld: imagePlacement(size, stretch), hatch: pixels.hatch });
    }
    this.shadePlaced = { path, stretch, ...size };
    requestRender(this.deps.app);
  }

  private placeRelief(path: string | null, size: { width: number; height: number } | null, stretch: MapStretch | null): void {
    const image = this.reliefRead?.path === path ? this.reliefRead?.value ?? null : null;
    const placed = this.reliefMap;
    if (path && image && size && stretch && placed?.path === path && placed.width === size.width && placed.height === size.height && sameStretch(placed.stretch, stretch)) return;
    if (!placed && (!path || !image || !size || !stretch)) return;
    this.reliefMap = path && image && size && stretch ? { map: new ReliefMap(image, imagePlacement(size, stretch)), path, stretch, ...size } : null;
    // The lighting takes the new relief at once, and lets go of the old one before it goes.
    this.deps.onReliefChange();
    placed?.map.destroy();
  }
}

/** The relief's heights: the red of each pixel. */
function reliefOf({ width, height, data }: ShadingPixels): ReliefImage {
  const heights = new Uint8Array(width * height);
  for (let k = 0; k < heights.length; k++) heights[k] = data[k * 4]!;
  return { width, height, heights };
}
