import { normalizePath, type App } from 'obsidian';
import { decodeImage, imageMimeType } from '../decodedImage';
import { isVideoMapPath, videoMimeType } from '../mapImage/video/videoMapFiles';
import { openVideoElement } from '../mapImage/video/videoElement';
import type { ReadUnexploredImage } from './UnexploredImage';

/**
 * Reads a vault file for a level's fog map (`UnexploredImage`): a video (WebM, MP4) as an animated
 * map is opened, in `doc`, the document of the view that shows it; any other file as an image.
 * Null when the file is not there.
 */
export function vaultImageReader(app: App, doc: () => Document = (): Document => activeDocument): ReadUnexploredImage {
  return async (path, maxSide) => {
    const file = app.vault.getFileByPath(normalizePath(path));
    if (!file) return null;
    const bytes = await app.vault.readBinary(file);
    if (isVideoMapPath(file.path)) return { kind: 'video', video: await openVideoElement(doc(), bytes, videoMimeType(file.path)) };
    return { kind: 'image', image: await decodeImage(bytes, imageMimeType(file.extension), maxSide) };
  };
}
