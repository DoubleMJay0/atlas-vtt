import type { App } from 'obsidian';
import type { StoreApi } from 'zustand';
import { loadAtlasView } from '../../../plugin/atlasLeaves';
import type { ViewAtlasState } from '../../../storeFactory';
import type { DungeonGeneratorRequest } from '../../../types/viewUIState';
import { showNotice } from '../../../ui/notice';
import { t } from '../../../i18n';
import type { CreatedDungeonScene } from './useGeneratorActions';

/** The pins waiting for a scene, by the opening that will make it. */
const waiting = new Map<number, (scene: CreatedDungeonScene | null) => void>();
let openings = 0;

/** Hands a waiting pin its scene, or null when the generator closed without one; once. */
export function settleDungeonRequest(id: number, scene: CreatedDungeonScene | null): void {
  const settle = waiting.get(id);
  waiting.delete(id);
  settle?.(scene);
}

/** A newer opening replaces the one shown; the replaced one's overlay settles its pin as it leaves (`DungeonGeneratorOverlay`). */
function open(store: StoreApi<ViewAtlasState>, request: Omit<DungeonGeneratorRequest, 'id'>): number {
  openings += 1;
  store.getState().openDungeonGenerator({ id: openings, ...request });
  return openings;
}

/**
 * Opens the dungeon generator in the middle of the Atlas view's map for `collectionId` (the asset
 * manager's Generate Dungeon), bringing the view to the front. Without an Atlas view the GM is told to open one.
 */
export async function showDungeonGenerator(app: App, collectionId: string): Promise<void> {
  const view = await loadAtlasView(app);
  if (!view) {
    showNotice(t('dungeon.needsAtlasView'));
    return;
  }
  await app.workspace.revealLeaf(view.leaf);
  open(view.getStore(), { collectionId, name: '', waiting: false });
}

/**
 * Opens the dungeon generator over the map for a scene a note pin asks for, with its name and
 * collection fixed, in the place of the pin's dropdown (`anchor`). Resolves with the scene once it
 * was created (the generator closes and the map shows again), or null when it closed without one.
 */
export function generateDungeonFor(
  store: StoreApi<ViewAtlasState>,
  options: { name: string; collectionId: string; anchor?: DungeonGeneratorRequest['anchor'] },
): Promise<{ scenePath: string; entryLevel?: string } | null> {
  return new Promise((resolve) => {
    const id = open(store, { collectionId: options.collectionId, name: options.name, waiting: true, ...(options.anchor && { anchor: options.anchor }) });
    waiting.set(id, (scene) => resolve(scene ? { scenePath: scene.scenePath, ...(scene.entryLevel && { entryLevel: scene.entryLevel }) } : null));
  });
}
