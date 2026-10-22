import React, { useId } from 'react';
import type { CollectionMetadata } from '../../../services/AssetService';
import { CollectionSelect } from '../asset-manager/token-creator/CollectionSelect';
import { t } from '../../../i18n';
import { DungeonIdentity } from './DungeonIdentity';
import { SettingsSection } from './fields';
import { StyleSettings } from './StyleSettings';
import { TagChips } from './TagChips';
import type { DungeonState } from './useDungeonState';
import type { ThumbnailRenderer } from './useStyleThumbnails';
import { ViewSettings } from './ViewSettings';

interface GeneratorSettingsProps {
  state: DungeonState;
  /** Where the panel's lists open, so the sidebar's scrolling never clips them. */
  layer: HTMLElement | null;
  /** Offered where the GM may pick the collection the scene goes to. */
  collection?: { id: string; options: CollectionMetadata[]; onChange: (id: string) => void } | undefined;
  /** Draws the style gallery's thumbnails. */
  thumbnails: ThumbnailRenderer;
}

/**
 * The sidebar's settings, in the order a dungeon is made: where its scene goes and what it is
 * called, which tags, how it is drawn, what the map shows.
 */
export function GeneratorSettings({ state, layer, collection, thumbnails }: GeneratorSettingsProps): React.JSX.Element {
  const { request, settings } = state;
  const collectionId = useId();
  return (
    <div className="atlas-dungeon-generator__settings">
      <div className="atlas-dungeon-fields">
        {collection && collection.options.length > 1 && (
          <div className="atlas-dungeon-field atlas-dungeon-field--stacked" role="group" aria-labelledby={collectionId}>
            <span id={collectionId} className="atlas-dungeon-field__label">{t('dungeon.collection')}</span>
            <CollectionSelect value={collection.id} options={collection.options} onChange={collection.onChange} />
          </div>
        )}
        <DungeonIdentity
          name={state.name}
          seed={request.seed}
          onName={state.setName}
          onSeed={state.setSeed}
          onNew={state.newSeed}
        />
      </div>
      <SettingsSection title={t('dungeon.tags')}>
        <TagChips picked={state.draftTags} applied={request.tags} onToggle={state.toggleDraftTag} onGenerate={state.generate} onRandom={state.random} />
      </SettingsSection>
      <SettingsSection title={t('dungeon.style')}>
        <StyleSettings state={state} renderer={thumbnails} />
      </SettingsSection>
      <SettingsSection title={t('dungeon.view')}>
        <ViewSettings view={settings.view} waterLevel={request.waterLevel} onView={state.setView} onWaterLevel={state.setWaterLevel} layer={layer} />
      </SettingsSection>
    </div>
  );
}
