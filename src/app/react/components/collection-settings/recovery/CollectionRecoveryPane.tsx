import React from 'react';
import type { App } from 'obsidian';
import { collectionRecoveryRecord, editedRecovery, presetRecovery, recoveryTemplateIds } from '../../../../recovery/collectionRecovery';
import type { AssetService } from '../../../../services/AssetService';
import { collectionStatblockRoles } from '../../../../statblocks/roles/collectionStatblockRoles';
import type { SystemPreset } from '../../../../types/systemPresetTypes';
import type { CollectionSettingsDraft } from '../useCollectionSettingsDraft';
import { RecoveryPane } from './RecoveryPane';
import { useRecoveryTemplates } from './useRecoveryTemplates';

interface CollectionRecoveryPaneProps {
  app: App;
  assetService: AssetService | null;
  collectionId: string;
  draft: CollectionSettingsDraft;
  presets: readonly SystemPreset[];
}

/**
 * The recovery pane of a collection's settings: its templates, and its buttons as the draft reads
 * them. An edit that ends where the collection's preset is stores nothing, so an untouched
 * collection keeps following its preset; the dialog saves the rest.
 */
export function CollectionRecoveryPane({ app, assetService, collectionId, draft, presets }: CollectionRecoveryPaneProps): React.ReactElement {
  const record = collectionRecoveryRecord(draft, presets);
  const roles = collectionStatblockRoles(draft, presets);
  const { tabs, templates } = useRecoveryTemplates(app, assetService, collectionId, roles, recoveryTemplateIds(record), true);

  return (
    <RecoveryPane
      tabs={tabs}
      templates={templates}
      resources={draft.resources}
      conditions={draft.conditions}
      record={record}
      onChange={(next) => draft.setRecovery(editedRecovery(next, presetRecovery(draft.systemPresetId, presets)))}
    />
  );
}
