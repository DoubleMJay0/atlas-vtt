import type { Application } from 'pixi.js';
import type { App } from 'obsidian';
import { viewedImagePlacement } from '../../levels/levelAlignment';
import { levelShading, NO_SHADING } from '../../levels/levelShading';
import { viewedLevelId } from '../../levels/sceneLevels';
import type { ViewAtlasStore } from '../../storeFactory';
import { MapController } from '../../MapController';
import type { MapImage } from '../mapImage/MapImage';
import type { EngineRelief } from '../lighting/engine/ReliefMap';
import type { ShadeLayer } from '../lighting/engine/ShadeLayer';
import { LevelShading } from '../lighting/levels/LevelShading';
import { MAP_LAYER_Z } from '../mapLayerOrder';
import { requestRender } from '../RenderScheduler';
import { usesCanvasRenderer } from '../utils/rendererType';
import { readShadingImage } from './shadingImages';

export interface ViewShadingDeps {
  obsApp: App;
  app: Application;
  store: ViewAtlasStore;
  /** The view's map image, while it has one. */
  mapImage: () => MapImage | null;
  /** The relief changed: the lighting casts its lights' shadows from the new one (`relief()`). */
  onReliefChange: () => void;
}

/**
 * The shading of the level a view shows (`LevelShading`): its shade over the map at
 * `MAP_LAYER_Z.shade`, its relief for the view's lighting. It follows the store and the map image:
 * nothing shows while the scene loads or the map image still shows another level's.
 */
export class ViewShading {
  private readonly shading: LevelShading;
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly deps: ViewShadingDeps) {
    this.shading = new LevelShading({
      gpu: !usesCanvasRenderer(deps.app.renderer),
      read: (path) => readShadingImage(deps.obsApp, path),
      requestRender: () => requestRender(deps.app),
      onRead: () => this.follow(),
      onReliefChange: deps.onReliefChange,
    });
    this.layer.view.zIndex = MAP_LAYER_Z.shade;
    this.cleanups.push(
      deps.store.subscribe(() => this.follow()),
      // A level's map image finished loading: the level shows now.
      MapController.onBackgroundLoaded(() => this.follow()),
    );
    this.follow();
  }

  get layer(): ShadeLayer {
    return this.shading.layer;
  }

  relief(): EngineRelief | null {
    return this.shading.relief();
  }

  /** Brings the shading to the level shown and its map as drawn; call it when the map image changes. */
  follow(): void {
    const state = this.deps.store.getState();
    const mapImage = this.deps.mapImage();
    const shown = !state.isMapLoading && MapController.showsViewedLevel(mapImage, state) ? mapImage : null;
    const size = shown?.imageSize ?? null;
    const map = shown && size ? { size, drawn: shown.mapStretch, placed: viewedImagePlacement(state) } : null;
    this.shading.follow(shown ? levelShading(state, viewedLevelId(state)) : NO_SHADING, map);
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.shading.destroy();
  }
}
