import type { App, TFile } from 'obsidian';
import { sceneImagePaths } from '../levels/levelFile';
import { sceneShadingPaths } from '../levels/levelShading';
import { collectionFolderPath, GLOBAL_ASSETS_DIR } from './assetPaths';
import type { Asset } from './AssetService';

/** The state a scene's file holds; null where it cannot be read. */
async function sceneFileState(app: App, file: TFile): Promise<unknown> {
  try {
    const envelope: unknown = JSON.parse(await app.vault.read(file));
    return typeof envelope === 'object' && envelope !== null && 'state' in envelope ? envelope.state : null;
  } catch {
    return null;
  }
}

/** The relief and shade images a scene's file names (`sceneShadingPaths`, only paths a scene may name); none where it cannot be read. */
export async function sceneFileShading(app: App, file: TFile): Promise<string[]> {
  return sceneShadingPaths(await sceneFileState(app, file));
}

/** Every image a scene's file shows (`sceneImagePaths`): its maps, roofs, reliefs and shades. */
export async function sceneFileImages(app: App, file: TFile): Promise<string[]> {
  const state = await sceneFileState(app, file);
  return typeof state === 'object' && state !== null ? sceneImagePaths(state) : [];
}

/** Whether `path` lies where Atlas writes a scene's relief and shade: a PNG in its shared assets folder or in the scene's collection. */
export function ownShadingFile(path: string, collectionId: string): boolean {
  return path.toLowerCase().endsWith('.png') && (path.startsWith(`${GLOBAL_ASSETS_DIR}/`) || path.startsWith(`${collectionFolderPath(collectionId)}/`));
}

/** The image files an asset's record names: a map's image and thumbnail, a token's art and thumbnail. */
export function assetImagePaths(asset: Asset): string[] {
  const paths: (string | undefined)[] = [];
  if (asset.type === 'map') paths.push(asset.mapFilePath, asset.thumbnailPath);
  if (asset.type === 'token') paths.push(asset.imagePath, asset.thumbnailPath);
  return paths.filter((path): path is string => !!path);
}
