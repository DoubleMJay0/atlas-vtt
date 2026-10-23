import { Ticker, type Application, type Container } from 'pixi.js';
import type { App } from 'obsidian';
import type { Viewport } from 'pixi-viewport';
import { mapImageSourceFor } from '../../MapLoader';
import { MISSING_ASSET_SIZE } from '../../services/AssetValidationService';
import type { LevelArt } from '../../levels/artRaster';
import { MapImage } from '../mapImage/MapImage';
import { MapImageService } from '../mapImage/MapImageService';
import type { MapImageViewport } from '../mapImage/mapImageTypes';
import type { PixelRect } from '../mapImage/pyramid';
import type { MapStretch } from '../../grid/mapStretch';
import { requestRender } from '../RenderScheduler';
import { TextureCache } from '../token-renderer/TextureCache';
import type { FogCover } from '../../vision/throughSight';
import type { BelowMapImage } from './levels/BelowLevel';
import type { BelowLevelsHost } from './levels/LevelsBelow';
import type { RoofHost, RoofImageRead } from './levels/Roof';
import type { Point } from '../../types/visionTypes';

export interface BelowLevelsHostDeps {
  obsApp: App;
  app: Application;
  viewport: Viewport;
  /** The committed fog of the level the view shows. */
  viewedFog: () => FogCover;
  /** Whether the roof of the level the view shows covers a point in the players' picture. */
  viewedRoof: () => ((point: Point) => boolean) | null;
  /** Puts the openings' eraser into the view's stage, between its grid and its tokens. */
  placeEraser: (eraser: Container) => void;
}

/**
 * The view's camera for a map image of a level below: it reads where the view looks, so its tiles
 * follow the view's, and keeps the world size it sets to itself, which is the view's own image's.
 */
function viewCamera(viewport: Viewport): MapImageViewport {
  return {
    get left(): number { return viewport.left; },
    get top(): number { return viewport.top; },
    get worldScreenWidth(): number { return viewport.worldScreenWidth; },
    get worldScreenHeight(): number { return viewport.worldScreenHeight; },
    get scale(): { x: number } { return viewport.scale; },
    worldWidth: 0,
    worldHeight: 0,
  };
}

/** `image` as a level below reads it: backgrounds are loaded from the vault. A video map shows its poster, as a picture of the scene does. */
function belowMapImage(obsApp: App, image: MapImage): BelowMapImage {
  return {
    layer: image.layer,
    get worldRect(): PixelRect | null { return image.worldRect; },
    get imageSize(): { width: number; height: number } | null { return image.imageSize; },
    get mapStretch(): MapStretch { return image.mapStretch; },
    load: (background, gridSize, stretch) => image.load(mapImageSourceFor(obsApp, background, gridSize), stretch),
    setStretch: (stretch) => image.setStretch(stretch),
    drawFor: (view) => image.drawFor(view),
    addDemandRegion: (view) => image.addDemandRegion(view),
    destroy: () => image.destroy(),
  };
}

/** A map without an image: no pixel of it holds art. */
const CLEAR = { width: 1, height: 1, opaque: new Uint8Array(1) };

/**
 * A level's map as the level stack reads it, of the image a `MapImage` shows for `background`: a
 * level without one holds no art; a missing or unreadable image shows the placeholder, whose
 * transparency is not known, which holds art everywhere.
 */
async function readLevelArt(obsApp: App, background: string | null, gridSize: number | undefined): Promise<LevelArt> {
  const source = mapImageSourceFor(obsApp, background, gridSize);
  if (source.kind === 'none') return { width: source.width, height: source.height, alpha: CLEAR };
  const placeholder = { width: MISSING_ASSET_SIZE, height: MISSING_ASSET_SIZE, alpha: null };
  if (source.kind === 'placeholder') return placeholder;
  try {
    return await MapImageService.forApp(obsApp).levelArt(source.file);
  } catch (error) {
    console.warn(`[Atlas] The transparent parts of ${source.file.path} could not be read:`, error);
    return placeholder;
  }
}

/** A map image drawn through the view's camera, never changing the view's own (a level below's map, a roof). */
function createViewMapImage(obsApp: App, app: Application, viewport: Viewport): BelowMapImage {
  return belowMapImage(obsApp, new MapImage({
    service: MapImageService.forApp(obsApp),
    viewport: viewCamera(viewport),
    ticker: Ticker.shared,
    renderer: app.renderer,
    requestRender: () => requestRender(app),
  }));
}

/** A roof image's size and pieces (`roofPieces`), read in the tile worker; rejects where it is no image of the vault. */
async function readRoofImage(obsApp: App, path: string): Promise<RoofImageRead> {
  const source = mapImageSourceFor(obsApp, path, undefined);
  if (source.kind !== 'file' && source.kind !== 'video') throw new Error(`No image at ${path}`);
  return MapImageService.forApp(obsApp).roofPieces(source.file);
}

/** What a map view gives its roofs: map images through its camera, and the pieces of a roof image. */
export function createRoofHost(obsApp: App, app: Application, viewport: Viewport): RoofHost {
  return {
    createMapImage: () => createViewMapImage(obsApp, app, viewport),
    readRoof: (path) => readRoofImage(obsApp, path),
  };
}

/** What a map view gives the levels below it: map images through its camera, token art, the levels' maps, its fog and a place for the eraser. */
export function createBelowLevelsHost({ obsApp, app, viewport, viewedFog, viewedRoof, placeEraser }: BelowLevelsHostDeps): BelowLevelsHost {
  return {
    ...createRoofHost(obsApp, app, viewport),
    createArt: () => {
      const art = new TextureCache(obsApp);
      art.setPixiApp(app);
      return art;
    },
    levelArt: (background, gridSize) => readLevelArt(obsApp, background, gridSize),
    viewedFog,
    viewedRoof,
    placeEraser,
  };
}
