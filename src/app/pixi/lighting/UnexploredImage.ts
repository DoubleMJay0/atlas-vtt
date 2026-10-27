import { Matrix, Texture } from 'pixi.js';
import { worldToImage, type ImageSize, type MapStretch } from '../../grid/mapStretch';
import { unexploredSoftnessOf } from '../../lighting/sceneLightingOptions';
import type { SceneLighting } from '../../types/lightingTypes';
import { decodedSource, type DecodedImage } from '../decodedImage';
import type { EngineScene } from './engine/types';

/** Decodes the vault image at `path` to fit `maxSide` a side; null when the file is not there. */
export type ReadUnexploredImage = (path: string, maxSide: number) => Promise<DecodedImage | null>;

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
 * of the fade into it in world pixels.
 */
export function unexploredLook(texture: Texture | null, scene: { lighting: Pick<SceneLighting, 'unexploredSoftness'>; grid?: { size?: number } | null | undefined }, image: DrawnMapImage | null): Pick<EngineScene, 'unexploredTexture' | 'unexploredSoftness' | 'unexploredPlacement'> {
  if (!texture) return { unexploredTexture: null };
  return {
    unexploredTexture: texture,
    unexploredSoftness: unexploredSoftnessOf(scene.lighting) * (scene.grid?.size ?? DEFAULT_CELL_SIZE),
    ...(image && { unexploredPlacement: unexploredPlacement(image) }),
  };
}

/**
 * A level's fog map for never-seen areas (`SceneLighting.unexploredImage`) as a mipmapped
 * texture, decoded the first time its path is asked for. A texture the engine was given is
 * destroyed only after the engine has its replacement (`release`).
 */
export class UnexploredImage {
  private path: string | null = null;
  private texture: Texture | null = null;
  private image: DecodedImage | null = null;
  private retired: Array<{ texture: Texture; image: DecodedImage }> = [];

  /** `ready` is called once a texture asked for has been made. */
  constructor(private readonly read: ReadUnexploredImage, private readonly ready: () => void) {}

  /** The texture of the image at `path`; null without a path, while it is being decoded, or when it cannot be read. */
  textureOf(path: string | null): Texture | null {
    if (path === this.path) return this.texture;
    this.retire();
    this.path = path;
    if (path) this.load(path);
    return null;
  }

  /** Destroys the textures that were replaced: call once the engine holds the current one. */
  release(): void {
    for (const { texture, image } of this.retired) {
      texture.destroy(true);
      closeImage(image);
    }
    this.retired = [];
  }

  destroy(): void {
    this.retire();
    this.release();
    this.path = null;
  }

  private load(path: string): void {
    this.read(path, UNEXPLORED_IMAGE_MAX_SIDE).then(
      (image) => {
        if (this.path !== path) {
          if (image) closeImage(image);
          return;
        }
        if (!image) {
          console.warn(`[Atlas] The fog map for unexplored areas was not found: ${path}`);
          return;
        }
        const source = decodedSource(image, { autoGenerateMipmaps: true, scaleMode: 'linear', label: 'unexplored-image' });
        // Collected, it would be uploaded again from a bitmap that may be closed by then.
        source.autoGarbageCollect = false;
        this.image = image;
        this.texture = new Texture({ source, label: 'unexplored-image' });
        this.ready();
      },
      (error: unknown) => {
        if (this.path === path) console.warn(`[Atlas] The fog map for unexplored areas could not be read: ${path}`, error);
      },
    );
  }

  private retire(): void {
    if (this.texture && this.image) this.retired.push({ texture: this.texture, image: this.image });
    this.texture = null;
    this.image = null;
  }
}

/** A bitmap holds its pixels until closed; a canvas is collected with its texture. */
function closeImage(image: DecodedImage): void {
  if (image instanceof ImageBitmap) image.close();
}
