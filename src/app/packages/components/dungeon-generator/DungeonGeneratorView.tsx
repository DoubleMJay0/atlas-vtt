import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ItemView, type App, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { ATLAS_VIEW_TYPE } from '../../../atlasViewType';
import { openCreatedScene } from '../../../import/openCreatedScene';
import { openMapInView } from '../../../plugin/atlasLeaves';
import { AssetService } from '../../../services/AssetService';
import { isRecord } from '../../../utils/guards';
import { useAssetCatalog } from '../asset-manager/token-creator/useAssetCatalog';
import { t } from '../../../i18n';
import { DungeonGeneratorPanel } from './DungeonGeneratorPanel';
import type { CreatedDungeonScene } from './useGeneratorActions';

export const DUNGEON_GENERATOR_VIEW_TYPE = 'atlas-dungeon-generator';

/** A scene asked for from elsewhere (the note pin search): its name and collection are fixed. */
export interface DungeonGeneratorTask {
  name: string;
  collectionId: string;
  /** Called once: with the scene created, or null when the tab closed without one. */
  done: (scene: CreatedDungeonScene | null) => void;
  /** The tab that asked, made active again once the scene is created. */
  returnTo: WorkspaceLeaf | null;
}

function readCollectionId(state: unknown): string | null {
  if (!isRecord(state)) return null;
  const value = state.collectionId;
  return typeof value === 'string' && value !== '' ? value : null;
}

function isOpen(app: App, leaf: WorkspaceLeaf): boolean {
  let open = false;
  app.workspace.iterateAllLeaves((candidate) => {
    if (candidate === leaf) open = true;
  });
  return open;
}

interface PageProps {
  app: App;
  collectionId: string;
  /** Unset where the collection is fixed. */
  onCollectionChange: ((id: string) => void) | undefined;
  name: string;
  onCreated: (scene: CreatedDungeonScene) => void;
  onBusyChange: (busy: boolean) => void;
}

/** The generator filling its tab; the collections are offered where the GM may choose one. */
function GeneratorPage({ app, collectionId, onCollectionChange, name, onCreated, onBusyChange }: PageProps): React.JSX.Element {
  const { collections } = useAssetCatalog(app, onCollectionChange !== undefined);
  return (
    <DungeonGeneratorPanel
      app={app}
      collectionId={collectionId}
      collections={onCollectionChange ? collections : undefined}
      onCollectionChange={onCollectionChange}
      initialName={name}
      onCreated={onCreated}
      onBusyChange={onBusyChange}
    />
  );
}

/**
 * The dungeon generator in a tab of its own. Its state is the collection a scene goes to; the
 * dungeon itself is never saved with the workspace, so a tab restored after a reload shows a
 * fresh dungeon in the look Atlas' settings keep. A tab opened for a task (`take`) creates its
 * scene, closes and makes the asking tab active again; any other opens the scene it created.
 */
export class DungeonGeneratorView extends ItemView {
  private root: Root | null = null;
  private collectionId = AssetService.defaultCollectionId();
  private task: DungeonGeneratorTask | null = null;
  /** Each task is a dungeon of its own: the panel is mounted anew for it. */
  private session = 0;
  private busy = false;
  private closed = false;

  getViewType(): string {
    return DUNGEON_GENERATOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('dungeon.title');
  }

  getIcon(): string {
    return 'castle';
  }

  /** Whether the tab works for a task; a free tab may be reused for another opening. */
  hasTask(): boolean {
    return this.task !== null;
  }

  getState(): Record<string, unknown> {
    return { ...super.getState(), collectionId: this.collectionId };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const collectionId = readCollectionId(state);
    if (collectionId && !this.task) this.collectionId = collectionId;
    await super.setState(state, result);
    this.render();
  }

  /** Makes this tab work for `task`: its name and collection, a new dungeon. */
  take(task: DungeonGeneratorTask): void {
    this.finish(null);
    this.task = task;
    this.collectionId = task.collectionId;
    this.session += 1;
    this.render();
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('atlas-vtt-plugin', 'atlas-dungeon-generator-view');
    this.root = createRoot(this.contentEl);
    this.render();
  }

  async onClose(): Promise<void> {
    this.closed = true;
    // A scene under way is still written; its task hears of it once it is (`created`).
    if (!this.busy) this.finish(null);
    // Unmounting closes the preview's and the thumbnails' bitmaps and drops waiting jobs.
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }

  private render(): void {
    const task = this.task;
    this.root?.render(
      <GeneratorPage
        key={this.session}
        app={this.app}
        collectionId={this.collectionId}
        onCollectionChange={task ? undefined : (id) => {
          this.collectionId = id;
          this.render();
          this.app.workspace.requestSaveLayout();
        }}
        name={task?.name ?? ''}
        onCreated={(scene) => this.created(scene)}
        onBusyChange={(busy) => {
          this.busy = busy;
          if (!busy && this.closed) this.finish(null);
        }}
      />,
    );
  }

  private finish(scene: CreatedDungeonScene | null): void {
    const task = this.task;
    this.task = null;
    task?.done(scene);
  }

  private created(scene: CreatedDungeonScene): void {
    const task = this.task;
    if (task) {
      this.finish(scene);
      if (!this.closed) this.leaf.detach();
      if (task.returnTo && isOpen(this.app, task.returnTo)) this.app.workspace.setActiveLeaf(task.returnTo, { focus: true });
      return;
    }
    if (!this.closed) void this.showScene(scene);
  }

  /** Opens the created scene: in the Atlas view where one is open, else in this tab. */
  private async showScene(scene: CreatedDungeonScene): Promise<void> {
    const file = this.app.vault.getFileByPath(scene.scenePath);
    if (file && this.app.workspace.getLeavesOfType(ATLAS_VIEW_TYPE).length > 0) {
      try {
        await openMapInView(this.app, file);
        this.leaf.detach();
        return;
      } catch (error) {
        console.error('[Atlas] A generated scene could not be opened in the Atlas view', error);
      }
    }
    await openCreatedScene(this.app, scene.scenePath, scene.name, this.leaf);
  }
}
