import { normalizePath, type App } from 'obsidian';
import { decodeImage, imageMimeType } from '../decodedImage';
import type { ReadUnexploredImage } from './UnexploredImage';

/** Decodes a vault image for a level's fog map (`UnexploredImage`); null when the file is not there. */
export function vaultImageReader(app: App): ReadUnexploredImage {
  return async (path, maxSide) => {
    const file = app.vault.getFileByPath(normalizePath(path));
    if (!file) return null;
    return decodeImage(await app.vault.readBinary(file), imageMimeType(file.extension), maxSide);
  };
}
