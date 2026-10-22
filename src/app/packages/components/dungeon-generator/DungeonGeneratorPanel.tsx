import React, { useMemo, useState } from 'react';
import type { App } from 'obsidian';
import type { CollectionMetadata } from '../../../services/AssetService';
import { dungeonStyle } from '../../../dungeons/styleCatalog';
import { DungeonWorkerClient } from '../../../dungeons/worker/DungeonWorkerClient';
import { ContextMenuProvider } from '../../../react/root/ContextMenuContext';
import { GeneratorFooter } from './GeneratorFooter';
import { GeneratorSettings } from './GeneratorSettings';
import { MapPreview } from './MapPreview';
import { usePreviewSize } from './PreviewCanvas';
import { useDungeonState } from './useDungeonState';
import { useGeneratorActions, type CreatedDungeonScene } from './useGeneratorActions';
import { useMapPreview } from './useMapPreview';
import './dungeon-generator-menus.scss';

export interface DungeonGeneratorPanelProps {
  app: App;
  collectionId: string;
  /** Offered where the GM may choose the collection the scene goes to. */
  collections?: CollectionMetadata[] | undefined;
  onCollectionChange?: ((id: string) => void) | undefined;
  /** The name typed where the generator was opened from: the scene's name to begin with. */
  initialName?: string | undefined;
  onCreated: (scene: CreatedDungeonScene) => void;
  /** A scene is being created: the dialog holding the panel stays open until it is done. */
  onBusyChange?: ((busy: boolean) => void) | undefined;
}

/** Marks the generator's menus (`dungeon-generator-menus.scss`). */
const MENU_OWNER = 'atlas-dungeon-generator';

/**
 * The dungeon generator: a live map preview on the left, drawn off the main thread, and the
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
  const preview = useMapPreview(client, {
    request: state.request,
    generated: state.generated,
    model: state.model,
    style: dungeonStyle(settings.style),
    view: settings.view,
    size,
  }, state.setGenerated);

  const actions = useGeneratorActions({
    app,
    client,
    state,
    collectionId,
    onCreated,
    onBusyChange,
  });

  return (
    <div ref={setRoot} className="atlas-dungeon-generator" tabIndex={-1} inert={actions.creating}>
      <div className="atlas-dungeon-generator__preview">
        <MapPreview
          preview={preview}
          view={settings.view}
          onFrame={setFrame}
          onHideWing={state.hideWing}
          onShowHiddenWings={state.edits.hiddenWings?.length ? state.showHiddenWings : undefined}
        />
      </div>
      <GeneratorSettings
        state={state}
        layer={root}
        collection={collections && onCollectionChange ? { id: collectionId, options: collections, onChange: onCollectionChange } : undefined}
        thumbnails={client}
      />
      <GeneratorFooter actions={actions} ready={state.model !== null} named={state.name.trim() !== ''} />
    </div>
  );
}
