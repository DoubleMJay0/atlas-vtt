import React from 'react';
import type { CollectionMetadata } from '../../../services/AssetService';
import { CollectionSelect } from '../asset-manager/token-creator/CollectionSelect';
import { t } from '../../../i18n';
import { DungeonIdentity } from './DungeonIdentity';
import { SettingsSection } from './fields';
import { StyleSettings } from './StyleSettings';
import { TagChips } from './TagChips';
import type { DungeonState } from './useDungeonState';
import { ViewSettings } from './ViewSettings';

interface GeneratorSettingsProps {
  state: DungeonState;
  /** Where the panel's lists open, so the column's scrolling never clips them. */
  layer: HTMLElement | null;
  /** Offered where the GM may pick the collection the scene goes to. */
  collection?: { id: string; options: CollectionMetadata[]; onChange: (id: string) => void } | undefined;
  onSavePalette: () => void;
}

/** The settings column: what dungeon, which tags, what the map shows, and how it is drawn. */
export function GeneratorSettings({ state, layer, collection, onSavePalette }: GeneratorSettingsProps): React.JSX.Element {
  const { request, settings } = state;
  return (
    <div className="atlas-dungeon-generator__settings">
      {collection && collection.options.length > 1 && (
        <CollectionSelect value={collection.id} options={collection.options} onChange={collection.onChange} />
      )}
      <DungeonIdentity
        name={state.name}
        seed={request.seed}
        onName={state.setName}
        onSeed={state.setSeed}
        onNew={state.newSeed}
      />
      <SettingsSection title={t('dungeon.tags')}>
        <TagChips picked={state.draftTags} applied={request.tags} onToggle={state.toggleDraftTag} onGenerate={state.generate} onRandom={state.random} />
      </SettingsSection>
      <SettingsSection title={t('dungeon.view')}>
        <ViewSettings view={settings.view} waterLevel={request.waterLevel} onView={state.setView} onWaterLevel={state.setWaterLevel} layer={layer} />
      </SettingsSection>
      <SettingsSection title={t('dungeon.style')}>
        <StyleSettings preset={settings.preset} style={settings.style} onStyle={state.setStyle} onPreset={state.applyPreset} onSavePalette={onSavePalette} layer={layer} />
      </SettingsSection>
    </div>
  );
}
