import { Matrix, Texture } from 'pixi.js';
import { worldToImage, type ImageSize, type MapStretch } from '../../grid/mapStretch';
import { unexploredSoftnessOf } from '../../lighting/sceneLightingOptions';
import type { SceneLighting } from '../../types/lightingTypes';
import { decodedSource, type DecodedImage } from '../decodedImage';
import { MapVideoLayer } from '../mosaicCanvas/video/MapVideoLayer';
import type { MapVideoMode } from '../mosaicCanvas/video/mapVideoPlayback';
import type { OpenedVideo } from '../mosaicCanvas/video/videoElement';
import type { EngineScene } from './engine/types';

/** A fog map as read from the vault: a still image, decoded, or a video (an animated fog map) with its first frame decoded. */
export type UnexploredSource = { kind: 'image'; image: DecodedImage } | { kind: 'video'; video: OpenedVideo };

/** Reads the vault file at `path`, an image decoded to fit `maxSide` a side or a video; null when the file is not there. */
export type ReadUnexploredImage = (path: string, maxSide: number) => Promise<UnexploredSource | null>;

/** A video fog map longer than this a side is not drawn: unlike an image it cannot be scaled down as it is read. */
export const UNEXPLORED_VIDEO_MAX_SIDE = 8192;

/**
 * Longest side of the fog map's texture. It covers the whole map like the albedo and shows only
 * where the players have seen nothing, so it needs no more detail than a lit map's overview.
 */
export const UNEXPLORED_IMAGE_MAX_SIDE = 4096;

/** How a level's map image is drawn: its own size in pixels and its placement on the grid (`MapStretch`). */
export interface DrawnMapImage {
  size: ImageSize;
  stretch: MapStretch;
}

const DEFAULT_CELL_SIZE = 70;

/**
 * Where a fog map lies: the matrix from world pixels to the fog map's texture coordinates, so that
 * it covers its level's map image exactly as that is drawn (stretched, turned level, placed in from
 * the origin). The fog map has the map's proportions; its own resolution does not matter.
 */
export function unexploredPlacement({ size, stretch }: DrawnMapImage): Matrix {
  const origin = worldToImage({ x: 0, y: 0 }, size, stretch);
  const right = worldToImage({ x: 1, y: 0 }, size, stretch);
  const down = worldToImage({ x: 0, y: 1 }, size, stretch);
  return new Matrix(
    (right.x - origin.x) / size.width, (right.y - origin.y) / size.height,
    (down.x - origin.x) / size.width, (down.y - origin.y) / size.height,
    origin.x / size.width, origin.y / size.height,
  );
}

/**
 * What the engine draws a level's fog map with (`EngineScene`): its texture (none: the unexplored
 * colour), where it lies (unset: over the lit world, until the map image is drawn), and the width
 * of the fade into it (and into the mist) in world pixels.
 */
export function unexploredLook(texture: Texture | null, scene: { lighting: Pick<SceneLighting, 'unexploredSoftness'>; grid?: { size?: number } | null | undefined }, image: DrawnMapImage | null): Pick<EngineScene, 'unexploredTexture' | 'unexploredSoftness' | 'unexploredPlacement'> {
  // The fade is the mist's too, which needs no fog map.
  const unexploredSoftness = unexploredSoftnessOf(scene.lighting) * (scene.grid?.size ?? DEFAULT_CELL_SIZE);
  if (!texture) return { unexploredTexture: null, unexploredSoftness };
  return { unexploredTexture: texture, unexploredSoftness, ...(image && { unexploredPlacement: unexploredPlacement(image) }) };
}

/** A fog map ready to draw: its texture, and what plays and frees it. */
interface Loaded {
  texture: Texture;
  /** The video's player, for an animated fog map. */
  video: MapVideoLayer | null;
  dispose(): void;
}

/**
 * A level's fog map for never-seen areas (`levelUnexploredImage`) as a texture, read the first
 * time its path is asked for: a still image mipmapped, or a video (WebM, MP4) whose texture takes
 * each decoded frame while it plays (`setMode`, as the view's animated map: `MapVideoLayer`). A
 * texture the engine was given is destroyed only after the engine has its replacement (`release`).
 */
export class UnexploredImage {
  private path: string | null = null;
  private current: Loaded | null = null;
  private retired: Loaded[] = [];
  private mode: MapVideoMode = 'pause';

  /**
   * `ready` is called once a texture asked for has been made; `requestRender` for each frame of a
   * video that plays, which the render scheduler cannot see by itself.
   */
  constructor(private readonly read: ReadUnexploredImage, private readonly ready: () => void, private readonly requestRender: () => void = noop) {}

  /** The texture of the fog map at `path`; null without a path, while it is being read, or when it cannot be. */
  textureOf(path: string | null): Texture | null {
    if (path === this.path) return this.current?.texture ?? null;
    this.retire();
    this.path = path;
    if (path) this.load(path);
    return null;
  }

  /** Plays, holds or stills a video fog map as the view's animated map does; a still image is not touched. */
  setMode(mode: MapVideoMode): void {
    this.mode = mode;
    this.current?.video?.setMode(mode);
  }

  /** Destroys the textures that were replaced: call once the engine holds the current one. */
  release(): void {
    for (const loaded of this.retired) loaded.dispose();
    this.retired = [];
  }

  destroy(): void {
    this.retire();
    this.release();
    this.path = null;
  }

  private load(path: string): void {
    this.read(path, UNEXPLORED_IMAGE_MAX_SIDE).then(
      (source) => {
        if (this.path !== path) {
          if (source) disposeSource(source);
          return;
        }
        if (!source) {
          console.warn(`[Atlas] The fog map for unexplored areas was not found: ${path}`);
          return;
        }
        const loaded = source.kind === 'image' ? stillImage(source.image) : this.video(source.video, path);
        if (!loaded) return;
        this.current = loaded;
        this.ready();
      },
      (error: unknown) => {
        if (this.path === path) console.warn(`[Atlas] The fog map for unexplored areas could not be read: ${path}`, error);
      },
    );
  }

  /** A video fog map, playing as the view's animated map does; null for one too large to draw. */
  private video(video: OpenedVideo, path: string): Loaded | null {
    const size = { width: video.element.videoWidth, height: video.element.videoHeight };
    if (!(size.width > 0 && size.height > 0) || Math.max(size.width, size.height) > UNEXPLORED_VIDEO_MAX_SIDE) {
      console.warn(`[Atlas] The video fog map is larger than ${UNEXPLORED_VIDEO_MAX_SIDE} px a side, or empty, and is not drawn: ${path}`);
      video.release();
      return null;
    }
    const layer = new MapVideoLayer(video, size, this.requestRender);
    layer.setMode(this.mode);
    // The layer's sprite is never drawn: its texture is what the composite reads.
    return { texture: layer.sprite.texture, video: layer, dispose: () => layer.destroy() };
  }

  private retire(): void {
    if (this.current) this.retired.push(this.current);
    this.current = null;
  }
}

/** A still fog map, mipmapped so that it stays calm zoomed out. */
function stillImage(image: DecodedImage): Loaded {
  const source = decodedSource(image, { autoGenerateMipmaps: true, scaleMode: 'linear', label: 'unexplored-image' });
  // Collected, it would be uploaded again from a bitmap that may be closed by then.
  source.autoGarbageCollect = false;
  const texture = new Texture({ source, label: 'unexplored-image' });
  return {
    texture,
    video: null,
    dispose: () => {
      texture.destroy(true);
      closeImage(image);
    },
  };
}

/** Frees what a read made that is no longer wanted. */
function disposeSource(source: UnexploredSource): void {
  if (source.kind === 'image') closeImage(source.image);
  else source.video.release();
}

/** A bitmap holds its pixels until closed; a canvas is collected with its texture. */
function closeImage(image: DecodedImage): void {
  if (image instanceof ImageBitmap) image.close();
}

function noop(): void {}
