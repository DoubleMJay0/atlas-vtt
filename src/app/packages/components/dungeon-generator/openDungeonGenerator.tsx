import React from 'react';
import { Modal, Scope, type App } from 'obsidian';
import { createRoot, type Root } from 'react-dom/client';
import { handledByAnotherControl } from '../../../keyboard/tooltipEscape';
import { ATLAS_NATIVE_MODAL_CLASSES } from '../../../ui/nativeModal';
import { t } from '../../../i18n';
import { DungeonGeneratorPanel } from './DungeonGeneratorPanel';
import type { CreatedDungeonScene } from './useGeneratorActions';

export interface OpenDungeonGeneratorOptions {
  /** The name typed where the generator was opened from; the generator names the dungeon without one. */
  name?: string;
  /** The collection the scene goes to. */
  collectionId: string;
}

/** The generator in a dialog of its own, for places outside the asset manager (the note pin search). */
class DungeonGeneratorModal extends Modal {
  private root: Root | null = null;
  private created: CreatedDungeonScene | null = null;
  private busy = false;

  constructor(app: App, private readonly options: OpenDungeonGeneratorOptions, private readonly done: (scene: CreatedDungeonScene | null) => void) {
    super(app);
    // Escape closes the dialog, unless a menu, list or editor inside it takes the key (left to it,
    // unprevented), or a scene is being made.
    this.scope = new Scope(this.scope);
    this.scope.register([], 'Escape', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (handledByAnotherControl(event) || target?.closest('.atlas-dungeon-generator [role="dialog"], [role="listbox"]') || this.modalEl.doc.querySelector('.atlas-ctx-menu')) return true;
      if (!this.busy) this.close();
      return false;
    });
  }

  onOpen(): void {
    this.modalEl.addClass(...ATLAS_NATIVE_MODAL_CLASSES, 'atlas-dungeon-generator-modal');
    this.titleEl.setText(t('dungeon.title'));
    this.root = createRoot(this.contentEl);
    this.root.render(
      <DungeonGeneratorPanel
        app={this.app}
        collectionId={this.options.collectionId}
        initialName={this.options.name}
        parentScope={this.scope}
        onBusyChange={(busy) => { this.busy = busy; }}
        onCreated={(scene) => {
          this.created = scene;
          this.close();
        }}
      />,
    );
  }

  close(): void {
    if (!this.busy) super.close();
  }

  onClose(): void {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
    this.done(this.created);
  }
}

/**
 * Opens the dungeon generator on its own. Resolves with the scene once it was created (the dialog
 * closes then), or null when the GM closed the dialog without creating one.
 */
export function openDungeonGenerator(app: App, options: OpenDungeonGeneratorOptions): Promise<{ scenePath: string } | null> {
  return new Promise((resolve) => {
    new DungeonGeneratorModal(app, options, (scene) => resolve(scene ? { scenePath: scene.scenePath } : null)).open();
  });
}
