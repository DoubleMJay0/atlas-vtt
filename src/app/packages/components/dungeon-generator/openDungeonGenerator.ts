import type { App, WorkspaceLeaf } from 'obsidian';
import { getActiveWorkspaceLeaf } from '../../../utils/embeddedLeafFocus';
import { DUNGEON_GENERATOR_VIEW_TYPE, DungeonGeneratorView } from './DungeonGeneratorView';

export interface OpenDungeonGeneratorOptions {
  /** The name typed where the generator was opened from: the scene's name to begin with. */
  name?: string;
  /** The collection the scene goes to. */
  collectionId: string;
}

/** Opens the generator's view in `leaf`, made active; null where the leaf holds none afterwards. */
async function openIn(leaf: WorkspaceLeaf, collectionId: string): Promise<DungeonGeneratorView | null> {
  await leaf.setViewState({ type: DUNGEON_GENERATOR_VIEW_TYPE, state: { collectionId }, active: true });
  return leaf.view instanceof DungeonGeneratorView ? leaf.view : null;
}

/**
 * Opens the dungeon generator in a new tab for a scene asked for elsewhere (the note pin search),
 * with its name and collection fixed. Resolves with the scene once it was created (the tab closes
 * and the asking tab is active again), or null when the tab was closed without one.
 */
export async function openDungeonGenerator(app: App, options: OpenDungeonGeneratorOptions): Promise<{ scenePath: string } | null> {
  const returnTo = getActiveWorkspaceLeaf(app.workspace);
  const view = await openIn(app.workspace.getLeaf('tab'), options.collectionId);
  if (!view) return null;
  return new Promise((resolve) => {
    view.take({
      name: options.name ?? '',
      collectionId: options.collectionId,
      returnTo,
      done: (scene) => resolve(scene ? { scenePath: scene.scenePath } : null),
    });
  });
}

/**
 * Shows the dungeon generator for `collectionId` (the asset manager's Generate dungeon): in the
 * generator tab already open for no task, which keeps its dungeon, else in a new tab.
 */
export async function showDungeonGenerator(app: App, options: { collectionId: string }): Promise<void> {
  for (const leaf of app.workspace.getLeavesOfType(DUNGEON_GENERATOR_VIEW_TYPE)) {
    await leaf.loadIfDeferred();
    if (leaf.view instanceof DungeonGeneratorView && !leaf.view.hasTask()) {
      await openIn(leaf, options.collectionId);
      await app.workspace.revealLeaf(leaf);
      return;
    }
  }
  await openIn(app.workspace.getLeaf('tab'), options.collectionId);
}
