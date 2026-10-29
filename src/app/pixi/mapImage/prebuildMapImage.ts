import { TFile, type App } from 'obsidian';
import { TileDecoderClient } from './TileDecoderClient';
import { requiredMainThreadDecode } from './mainThreadDecode';
import type { PyramidFacts } from './tileBlobs';

/**
 * Builds a freshly saved map image's tiles into this device's cache, so the
 * map's first open is as quick as any later one. Fire and forget: the build
 * gives way to every map being opened, the file is read only if the cache
 * cannot tell it by path, size and time (a video's pyramid is its poster's), and a failure costs nothing but
 * the head start (the map is built when it is first opened instead).
 */
export function prebuildMapImage(app: App, file: TFile): void {
  const identity = { path: file.path, size: file.stat.size, mtime: file.stat.mtime };
  TileDecoderClient.forApp(app)
    .prebuild(() => app.vault.readBinary(file), identity, requiredMainThreadDecode(file))
    .catch((error: unknown) => console.debug(`[Atlas] The tiles of ${file.path} were not built ahead`, error));
}

/** `prebuildMapImage` for the file at `path`; nothing when it is not there. */
export function prebuildMapImageAt(app: App, path: string): void {
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) prebuildMapImage(app, file);
}

/**
 * The complete pyramid of the map image at `path`, built first where the cache lacks it (the build
 * an open map started is waited for), with every tile's stored size; null for a file that is not
 * there, one built on this thread (an SVG, a video's poster: its pyramid is no copy of its bytes),
 * one too large or undecodable, or a build that could not finish.
 */
export async function ensureMapPyramid(app: App, path: string): Promise<PyramidFacts | null> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile) || requiredMainThreadDecode(file) !== undefined) return null;
  const client = TileDecoderClient.forApp(app);
  try {
    const built = await client.ensurePyramid(() => app.vault.readBinary(file), { path: file.path, size: file.stat.size, mtime: file.stat.mtime });
    return built.complete ? await client.pyramidFacts(built.hash) : null;
  } catch (error) {
    console.debug(`[Atlas] The tiles of ${file.path} could not be built`, error);
    return null;
  }
}
