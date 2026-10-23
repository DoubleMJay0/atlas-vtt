import React, { useMemo, useState } from 'react';
import type { App } from 'obsidian';
import type { CollectionMetadata } from '../../../services/AssetService';
import { dungeonStyle } from '../../../dungeons/styleCatalog';
import { DungeonWorkerClient } from '../../../dungeons/worker/DungeonWorkerClient';
import { ContextMenuProvider } from '../../../react/root/ContextMenuContext';
import { FloorSwitcher } from './FloorSwitcher';
import { GeneratorFooter } from './GeneratorFooter';
import { GeneratorSettings } from './GeneratorSettings';
import { MapPreview } from './MapPreview';
import { usePreviewSize } from './PreviewCanvas';
import { useDungeonState } from './useDungeonState';
import { useGeneratorActions, type CreatedDungeonScene } from './useGeneratorActions';
import { useMapPreview } from './useMapPreview';
import { t } from '../../../i18n';

export interface DungeonGeneratorPanelProps {
  app: App;
  collectionId: string;
  /** Offered where the GM may choose the collection the scene goes to. */
  collections?: CollectionMetadata[] | undefined;
  onCollectionChange?: ((id: string) => void) | undefined;
  /** The name typed where the generator was opened from: the scene's name to begin with. */
  initialName?: string | undefined;
  onCreated: (scene: CreatedDungeonScene) => void;
  /** A scene is being created: whoever holds the panel waits for it before letting go. */
  onBusyChange?: ((busy: boolean) => void) | undefined;
  /** What ends the header row, the overlay's close button. */
  header?: React.ReactNode;
}

/**
 * The dungeon generator, filling the Atlas view (`DungeonGeneratorOverlay`): a live map preview
 * drawn off the main thread fills the main area (with the floor switcher above it where the
 * dungeon has several floors), the settings stand in a sidebar on the right under the header row,
 * with Export and Create scene at its foot.
 */
export function DungeonGeneratorPanel(props: DungeonGeneratorPanelProps): React.JSX.Element {
  return (
    <ContextMenuProvider local>
      <GeneratorPanel {...props} />
    </ContextMenuProvider>
  );
}

function GeneratorPanel({ app, collectionId, collections, onCollectionChange, initialName, onCreated, onBusyChange, header }: DungeonGeneratorPanelProps): React.JSX.Element {
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
    floor: state.floor,
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
      <div className="atlas-dungeon-generator__header">
        <h2 className="atlas-dungeon-generator__title">{t('dungeon.title')}</h2>
        {header}
      </div>
      <div className="atlas-dungeon-generator__preview">
        <FloorSwitcher floors={state.floors} floor={state.floor} onFloor={state.setFloor} />
        <MapPreview
          preview={preview}
          view={settings.view}
          onFrame={setFrame}
          onHideWing={state.hideWing}
          onShowHiddenWings={state.edits.hiddenWings?.length ? state.showHiddenWings : undefined}
        />
      </div>
      <div className="atlas-dungeon-generator__sidebar">
        <GeneratorSettings
          state={state}
          layer={root}
          collection={collections && onCollectionChange ? { id: collectionId, options: collections, onChange: onCollectionChange } : undefined}
          thumbnails={client}
        />
        <GeneratorFooter actions={actions} ready={state.model !== null} named={state.name.trim() !== ''} />
      </div>
    </div>
  );
}
