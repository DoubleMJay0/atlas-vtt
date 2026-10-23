import React, { useEffect, useRef, useState } from 'react';
import { openCreatedScene } from '../../../import/openCreatedScene';
import { handledByAnotherControl } from '../../../keyboard/tooltipEscape';
import { useAtlasUI } from '../../../react/root/AtlasUIContext';
import { useAtlasStore, useViewStoreHook } from '../../../react/ViewStoreContext';
import type { DungeonGeneratorRequest } from '../../../types/viewUIState';
import { t } from '../../../i18n';
import { CloseButton } from '../primitives/CloseButton';
import { useAssetCatalog } from '../asset-manager/token-creator/useAssetCatalog';
import { DungeonGeneratorPanel } from './DungeonGeneratorPanel';
import { settleDungeonRequest } from './openDungeonGenerator';
import type { CreatedDungeonScene } from './useGeneratorActions';

/** The dungeon generator over the map while the view's store has it open. */
export function DungeonGeneratorOverlay(): React.JSX.Element | null {
  const request = useAtlasStore((s) => s.dungeonGenerator);
  const close = useAtlasStore((s) => s.closeDungeonGenerator);
  if (!request) return null;
  return <GeneratorOverlay key={request.id} request={request} onClose={close} />;
}

interface OverlayProps {
  request: DungeonGeneratorRequest;
  onClose: (id: number) => void;
}

/**
 * Fills the Atlas view (the leaf's `contain: strict` makes it the box of `position: fixed`), so
 * sidebars and splits shrink it with the map. A pin waiting for the scene gets it and the map
 * shows again; otherwise the created scene opens. Closing while a scene is written waits for it.
 */
function GeneratorOverlay({ request, onClose }: OverlayProps): React.JSX.Element {
  const { app } = useAtlasUI();
  const store = useViewStoreHook();
  const [collectionId, setCollectionId] = useState(request.collectionId);
  const { collections } = useAssetCatalog(app, !request.waiting);
  const busy = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    root.current?.focus();
    // Closed under it (the view went, or the generator was opened anew): a pin still waiting hears
    // no scene came, unless one is being written, which still answers it once written.
    return () => { if (!busy.current) settleDungeonRequest(request.id, null); };
  }, [request.id]);

  const close = (): void => {
    if (busy.current) return;
    settleDungeonRequest(request.id, null);
    onClose(request.id);
  };

  // A scene finished after the GM opened the generator anew closes nothing and opens nothing:
  // only a pin that waits for it still gets it.
  const created = (scene: CreatedDungeonScene): void => {
    settleDungeonRequest(request.id, scene);
    if (store.getState().dungeonGenerator?.id !== request.id) return;
    onClose(request.id);
    if (!request.waiting) void openCreatedScene(app, scene.scenePath, scene.name, { level: scene.entryLevel });
  };

  return (
    <div
      ref={root}
      className="atlas-dungeon-generator-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('dungeon.title')}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || handledByAnotherControl(event.nativeEvent)) return;
        event.preventDefault();
        close();
      }}
    >
      <DungeonGeneratorPanel
        app={app}
        collectionId={collectionId}
        collections={request.waiting ? undefined : collections}
        onCollectionChange={request.waiting ? undefined : setCollectionId}
        initialName={request.name}
        onCreated={created}
        onBusyChange={(now) => { busy.current = now; }}
        header={<CloseButton onClick={close} />}
      />
    </div>
  );
}
