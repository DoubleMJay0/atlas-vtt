import { BufferImageSource, Matrix, Texture } from 'pixi.js';
import { imageToWorld, type MapStretch } from '../../../grid/mapStretch';
import { reliefBlocks } from '../../../lighting/reliefBlocks';

/** A relief as its image holds it: one height byte per texel (0 the floor, 255 a wall's height), rows top first. */
export interface ReliefImage {
  width: number;
  height: number;
  heights: Uint8Array;
}

/**
 * How high everything on the map stands, as the lighting reads it (`RELIEF_GLSL`): the heights,
 * their blocks (`reliefBlocks`), and where the relief lies in the world.
 */
export interface EngineRelief {
  heights: Texture;
  blocks: Texture;
  /** Relief texels across and down. */
  width: number;
  height: number;
  /** Takes a world point to relief texels: column-major, as GLSL's mat3 has it. */
  worldToRelief: Float32Array;
  /** World pixels a relief texel spans at most: no relief shadow is traced finer. */
  texelWorld: number;
}

function heightTexture(image: ReliefImage): Texture {
  const texels = new Uint8Array(image.width * image.height * 4);
  for (let k = 0; k < image.heights.length; k++) {
    texels[k * 4] = image.heights[k]!;
    texels[k * 4 + 3] = 255;
  }
  return new Texture({ source: new BufferImageSource({ resource: texels, width: image.width, height: image.height, format: 'rgba8unorm', alphaMode: 'no-premultiply-alpha', scaleMode: 'linear', autoGenerateMipmaps: false }) });
}

/**
 * A relief on the GPU, lying over the world as `uvToWorld` places its image (0..1 across and down
 * to world pixels: the map's own placement, so it lies on the map exactly). Owned by whoever made
 * it: destroy it once the lighting has been given its replacement.
 */
export class ReliefMap {
  readonly relief: EngineRelief;

  constructor(image: ReliefImage, uvToWorld: Matrix) {
    const blocks = reliefBlocks(image.heights, image.width, image.height);
    // World → uv, then uv → texels.
    const inverse = uvToWorld.clone().invert();
    const [w, h] = [image.width, image.height];
    // The world length of one texel step along either axis of the image.
    const across = Math.hypot(uvToWorld.a, uvToWorld.b) / image.width;
    const down = Math.hypot(uvToWorld.c, uvToWorld.d) / image.height;
    this.relief = {
      heights: heightTexture(image),
      blocks: new Texture({ source: new BufferImageSource({ resource: blocks.data, width: blocks.columns, height: blocks.rows, format: 'rgba8unorm', alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGenerateMipmaps: false }) }),
      width: image.width,
      height: image.height,
      worldToRelief: new Float32Array([w * inverse.a, h * inverse.b, 0, w * inverse.c, h * inverse.d, 0, w * inverse.tx, h * inverse.ty, 1]),
      texelWorld: Math.max(across, down),
    };
  }

  destroy(): void {
    this.relief.heights.destroy(true);
    this.relief.blocks.destroy(true);
  }
}

/** Where an image drawn as a map of `size` with `stretch` lies: its corners (0..1 across and down) to world pixels. */
export function imagePlacement(size: { width: number; height: number }, stretch: MapStretch): Matrix {
  const origin = imageToWorld({ x: 0, y: 0 }, size, stretch);
  const across = imageToWorld({ x: size.width, y: 0 }, size, stretch);
  const down = imageToWorld({ x: 0, y: size.height }, size, stretch);
  return new Matrix(across.x - origin.x, across.y - origin.y, down.x - origin.x, down.y - origin.y, origin.x, origin.y);
}
