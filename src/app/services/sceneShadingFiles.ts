import type { App, TFile } from 'obsidian';
import { sceneShadingPaths } from '../levels/levelShading';

/** The relief and shade images a scene's file names (`sceneShadingPaths`); none where it cannot be read. */
export async function sceneFileShading(app: App, file: TFile): Promise<string[]> {
  try {
    const envelope: unknown = JSON.parse(await app.vault.read(file));
    return sceneShadingPaths(typeof envelope === 'object' && envelope !== null && 'state' in envelope ? envelope.state : null);
  } catch {
    return [];
  }
}
