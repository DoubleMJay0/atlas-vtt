import type { App } from 'obsidian';
import { getDomHost } from '../../host/dom';
import { readShadeHatch, SHADE_HATCH_KEY } from '../../lighting/shadeHatch';
import { imageDimensions } from '../../imageProcessing/imageDimensions';
import { readPngText } from '../../utils/pngText';
import type { ShadingPixels } from '../lighting/levels/LevelShading';

/**
 * The most pixels a relief or shade image may have, and its longest side. The generator writes a
 * few dozen pixels a cell (about 7 megapixels for the largest map a scene holds); a scene file is
 * untrusted, so a path naming a large picture is refused before anything is decoded.
 */
export const MAX_SHADING_PIXELS = 16_000_000;
export const MAX_SHADING_SIDE = 8192;

/** Whether a relief or shade of `size` (null: its header could not be read) is one Atlas decodes. */
export function shadingSizeAllowed(size: { width: number; height: number } | null): boolean {
  return !!size && size.width > 0 && size.height > 0 && size.width * size.height <= MAX_SHADING_PIXELS && Math.max(size.width, size.height) <= MAX_SHADING_SIDE;
}

/**
 * The pixels of a relief or shade image in the vault, read as bytes (never through a resource URL,
 * `rendering-and-teardown.md`), and the hatching a shade says it is cut in (`ShadeHatch`): they are
 * small, a few dozen pixels a cell, and lossless.
 */
export async function readShadingImage(app: App, path: string): Promise<ShadingPixels> {
  const file = app.vault.getFileByPath(path);
  if (!file) throw new Error('No such file.');
  const bytes = await app.vault.readBinary(file);
  const size = await imageDimensions(new Blob([bytes]));
  if (!shadingSizeAllowed(size)) throw new Error('Not a relief or shade image of a size Atlas reads.');
  const hatch = readShadeHatch(readPngText(new Uint8Array(bytes), SHADE_HATCH_KEY));
  const bitmap = await createImageBitmap(new Blob([bytes]), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  try {
    const canvas = getDomHost().createCanvas(undefined, { width: bitmap.width, height: bitmap.height });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No 2D canvas.');
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data, hatch };
  } finally {
    bitmap.close();
  }
}
