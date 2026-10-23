import type { App } from 'obsidian';
import { getDomHost } from '../../host/dom';
import { readShadeHatch, SHADE_HATCH_KEY } from '../../lighting/shadeHatch';
import { readPngText } from '../../utils/pngText';
import type { ShadingPixels } from '../lighting/levels/LevelShading';

/**
 * The pixels of a relief or shade image in the vault, read as bytes (never through a resource URL,
 * `rendering-and-teardown.md`), and the hatching a shade says it is cut in (`ShadeHatch`): they are
 * small, a few dozen pixels a cell, and lossless.
 */
export async function readShadingImage(app: App, path: string): Promise<ShadingPixels> {
  const file = app.vault.getFileByPath(path);
  if (!file) throw new Error('No such file.');
  const bytes = await app.vault.readBinary(file);
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
