import type { App } from 'obsidian';
import { getDomHost } from '../../host/dom';
import { readShadeHatch, SHADE_HATCH_KEY, type ShadeHatch } from '../../lighting/shadeHatch';
import { readPngText } from '../../utils/pngText';

/** An image's pixels, unpremultiplied RGBA, rows top first. */
export interface ShadingPixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** How the image is cut where its map is an engraving, as it says itself (`ShadeHatch`). */
  hatch: ShadeHatch | null;
}

/**
 * The pixels of a relief or shade image in the vault, read as bytes (never through a resource URL,
 * `rendering-and-teardown.md`): they are small, a few pixels a cell, and lossless.
 */
export async function readShadingImage(app: App, path: string): Promise<ShadingPixels> {
  const file = app.vault.getFileByPath(path);
  if (!file) throw new Error('No such file.');
  const bytes = await app.vault.readBinary(file);
  const hatch = readShadeHatch(readPngText(new Uint8Array(bytes), SHADE_HATCH_KEY));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
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

/** A canvas holding `pixels`, for a texture: PIXI premultiplies a canvas's pixels as it uploads them. */
export function shadeCanvas({ width, height, data }: ShadingPixels): HTMLCanvasElement {
  const canvas = getDomHost().createCanvas(undefined, { width, height });
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return canvas;
}
