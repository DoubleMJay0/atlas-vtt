import type { App, WorkspaceLeaf } from 'obsidian';
import { showNotice } from '../ui/notice';

/**
 * Opens a scene Atlas just created, as a new scene is opened (in `leaf` where one is given);
 * false where it could not be opened, which the GM is told (the scene stays in the Scenes tab).
 */
export async function openCreatedScene(app: App, scenePath: string, name: string, leaf?: WorkspaceLeaf): Promise<boolean> {
  const scene = app.vault.getFileByPath(scenePath);
  if (!scene) return false;
  try {
    await (leaf ?? app.workspace.getLeaf(false)).openFile(scene);
    return true;
  } catch (error) {
    console.error('[Atlas] A new scene could not be opened', error);
    showNotice(`"${name}" could not be opened. It is in the Scenes tab.`);
    return false;
  }
}
