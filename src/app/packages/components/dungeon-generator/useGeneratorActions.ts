import { useCallback, useRef, useState } from 'react';
import type { App } from 'obsidian';
import { createDungeonScene } from '../../../dungeons/scene/createDungeonScene';
import { maxPxPerCell } from '../../../dungeons/render/layoutSize';
import type { DungeonWorkerClient } from '../../../dungeons/worker/DungeonWorkerClient';
import { AssetService } from '../../../services/AssetService';
import { showNotice } from '../../../ui/notice';
import { parentPath } from '../../../utils/pathUtils';
import { t } from '../../../i18n';
import { saveDungeonExport, type DungeonExportKind } from './dungeonExports';
import type { DungeonState } from './useDungeonState';

/** A scene the generator made. */
export interface CreatedDungeonScene {
  name: string;
  scenePath: string;
}

export interface GeneratorActions {
  creating: boolean;
  /** Why the last scene could not be created. */
  problem: string | null;
  create: () => Promise<void>;
  /** The largest cell a map PNG of the shown dungeon may have; null until it is generated. */
  maxCell: number | null;
  exportAs: (kind: DungeonExportKind, pxPerCell?: number) => Promise<void>;
}

interface ActionOptions {
  app: App;
  client: DungeonWorkerClient;
  state: DungeonState;
  collectionId: string;
  /** Width over height of the preview, which a saved page keeps. */
  pageAspect: number;
  onCreated: (scene: CreatedDungeonScene) => void;
  onBusyChange?: ((busy: boolean) => void) | undefined;
}

/** Creating the scene and saving exports from what the panel shows. */
export function useGeneratorActions({ app, client, state, collectionId, pageAspect, onCreated, onBusyChange }: ActionOptions): GeneratorActions {
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = useRef({ state, collectionId, pageAspect, onCreated, onBusyChange });
  latest.current = { state, collectionId, pageAspect, onCreated, onBusyChange };
  const busy = useRef(false);

  const create = useCallback(async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    const now = latest.current;
    const { request, model, settings } = now.state;
    setCreating(true);
    setProblem(null);
    now.onBusyChange?.(true);
    try {
      const assetService = AssetService.getInstance(app);
      await assetService.initialize();
      const result = await createDungeonScene(app, assetService, {
        request,
        // The dungeon as shown, edits and moved notes included; generated anew where none arrived yet.
        ...(model ? { model } : {}),
        style: settings.style,
        view: settings.view,
        collectionId: now.collectionId,
      });
      if (result.ok) latest.current.onCreated({ name: result.name, scenePath: result.scenePath });
      else setProblem(result.problem);
    } catch (error) {
      console.error('[Atlas] Creating a dungeon scene failed', error);
      setProblem(t('dungeon.createFailed'));
    } finally {
      busy.current = false;
      setCreating(false);
      latest.current.onBusyChange?.(false);
    }
  }, [app]);

  const exportAs = useCallback(async (kind: DungeonExportKind, pxPerCell?: number): Promise<void> => {
    const { state: now, collectionId: collection, pageAspect: aspect } = latest.current;
    if (!now.model) return;
    try {
      const path = await saveDungeonExport({ app, render: (job) => client.render(job) }, kind, {
        request: now.request,
        model: now.model,
        style: now.settings.style,
        view: now.settings.view,
        collectionId: collection,
        pageAspect: aspect,
        ...(pxPerCell === undefined ? {} : { pxPerCell }),
      });
      showNotice(t('dungeon.export.saved', { name: path.slice(path.lastIndexOf('/') + 1), folder: parentPath(path) }));
    } catch (error) {
      console.error('[Atlas] A dungeon export failed', error);
      showNotice(t('dungeon.export.failed'));
    }
  }, [app, client]);

  return {
    creating,
    problem,
    create,
    maxCell: state.model ? maxPxPerCell(state.model, state.settings.view) : null,
    exportAs,
  };
}
