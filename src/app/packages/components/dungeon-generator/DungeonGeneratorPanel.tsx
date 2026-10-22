import React, { useMemo, useState } from 'react';
import type { App } from 'obsidian';
import type { CollectionMetadata } from '../../../services/AssetService';
import { DungeonWorkerClient } from '../../../dungeons/worker/DungeonWorkerClient';
import { ContextMenuProvider } from '../../../react/root/ContextMenuContext';
import { GeneratorFooter } from './GeneratorFooter';
import { GeneratorSettings } from './GeneratorSettings';
import { PagePreview } from './PagePreview';
import { usePreviewSize } from './PreviewCanvas';
import { useDungeonState } from './useDungeonState';
import { useGeneratorActions, type CreatedDungeonScene } from './useGeneratorActions';
import { usePagePreview } from './usePagePreview';
import './dungeon-generator-menus.scss';

export interface DungeonGeneratorPanelProps {
  app: App;
  collectionId: string;
  /** Offered where the GM may choose the collection the scene goes to. */
  collections?: CollectionMetadata[] | undefined;
  onCollectionChange?: ((id: string) => void) | undefined;
  /** The name typed where the generator was opened from. */
  initialName?: string | undefined;
  onCreated: (scene: CreatedDungeonScene) => void;
  /** A scene is being created: the dialog holding the panel stays open until it is done. */
  onBusyChange?: ((busy: boolean) => void) | undefined;
}

/** Marks the generator's menus (`dungeon-generator-menus.scss`). */
const MENU_OWNER = 'atlas-dungeon-generator';

/**
 * The dungeon generator: a live page preview on the left, drawn off the main thread, and the
 * settings beside it; below, Export and Create scene. The same panel serves the map creator's
 * Generate mode and the generator opened on its own (`openDungeonGenerator`).
 */
export function DungeonGeneratorPanel(props: DungeonGeneratorPanelProps): React.JSX.Element {
  return (
    <ContextMenuProvider local ownerId={MENU_OWNER}>
      <GeneratorPanel {...props} />
    </ContextMenuProvider>
  );
}

function GeneratorPanel({ app, collectionId, collections, onCollectionChange, initialName, onCreated, onBusyChange }: DungeonGeneratorPanelProps): React.JSX.Element {
  const client = useMemo(() => DungeonWorkerClient.forApp(app), [app]);
  const state = useDungeonState(app, initialName);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const size = usePreviewSize(frame);
  const { settings } = state;
  const preview = usePagePreview(client, {
    request: state.request,
    generated: state.generated,
    model: state.model,
    style: settings.style,
    view: settings.view,
    arrangement: state.arrangement,
    size,
  }, state.setGenerated);

  const actions = useGeneratorActions({
    app,
    client,
    state,
    collectionId,
    pageAspect: size ? size.width / size.height : 1.4,
    onCreated,
    onBusyChange,
  });

  return (
    <div ref={setRoot} className="atlas-dungeon-generator" tabIndex={-1} inert={actions.creating}>
      <div className="atlas-dungeon-generator__preview">
        <PagePreview
          preview={preview}
          notesMode={settings.view.notes}
          onFrame={setFrame}
          onTitle={state.editTitle}
          onStory={state.editStory}
          onNote={state.editNote}
          onHideWing={state.hideWing}
          onShowHiddenWings={state.edits.hiddenWings?.length ? state.showHiddenWings : undefined}
        />
      </div>
      <GeneratorSettings
        state={state}
        layer={root}
        collection={collections && onCollectionChange ? { id: collectionId, options: collections, onChange: onCollectionChange } : undefined}
        onSavePalette={() => { void actions.exportAs('palette'); }}
      />
      <GeneratorFooter actions={actions} ready={state.model !== null} />
    </div>
  );
}
