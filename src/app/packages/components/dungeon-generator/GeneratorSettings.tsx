import React, { useId, useState } from 'react';
import type { CollectionMetadata } from '../../../services/AssetService';
import { CollectionSelect } from '../asset-manager/token-creator/CollectionSelect';
import { refusedTags } from '../../../dungeons/themes/themes';
import { THEME_IDS, type ThemeChoice, type ThemeId } from '../../../dungeons/themes/themeTypes';
import { type DungeonTag, readTags } from '../../../dungeons/tags';
import { type MessageKey, t } from '../../../i18n';
import { DungeonIdentity } from './DungeonIdentity';
import { SelectRow, SettingsSection, SwitchRow } from './fields';
import { StyleSettings } from './StyleSettings';
import { TagChips } from './TagChips';
import { useScrollbarGutter } from '../primitives/useScrollbarGutter';
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

const themeName = (theme: ThemeId): string => t(`dungeon.theme.${theme}` as MessageKey);

/** The theme choices, Any first, naming the theme it gave the dungeon shown once there is one. */
function themeOptions(picked: ThemeId | undefined): { value: ThemeChoice; label: string }[] {
  const any = picked ? t('dungeon.theme.anyPicked', { theme: themeName(picked) }) : t('dungeon.theme.any');
  return [{ value: 'any', label: any }, ...THEME_IDS.map((theme) => ({ value: theme, label: themeName(theme) }))];
}

/** The tags the chosen theme refuses, with the reasons as shown; none for Any, which only picks among themes that take them. */
function refusedOf(choice: ThemeChoice, tags: readonly DungeonTag[]): ReadonlyMap<DungeonTag, string> {
  if (choice === 'any') return new Map();
  return new Map([...refusedTags(choice, tags)].map(([tag, reason]) => [tag, t(reason)]));
}

/**
 * The sidebar's settings, in the order a dungeon is made: where its scene goes and what it is
 * called, its seed, floors, theme and shape, which tags, how it is drawn, what the map shows.
 */
export function GeneratorSettings({ state, layer, collection, thumbnails }: GeneratorSettingsProps): React.JSX.Element {
  const { request, settings } = state;
  const theme = request.theme ?? 'any';
  const collectionId = useId();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  useScrollbarGutter(scroller);
  return (
    <div className="atlas-dungeon-generator__settings" ref={setScroller}>
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
          floors={state.floors}
          onFloors={state.setFloors}
          floorsFixed={request.fiveRoom === true}
        />
        <SelectRow<ThemeChoice>
          label={t('dungeon.theme.label')}
          value={theme}
          options={themeOptions(state.generated?.theme)}
          onChange={state.setTheme}
          layer={layer}
        />
        {/* A five-room dungeon's fourth room is its boss room whatever the switch says */}
        <SwitchRow
          label={t('dungeon.bossRoom')}
          hint={t('dungeon.bossRoom.hint')}
          value={request.bossRoom !== false || request.fiveRoom === true}
          disabled={request.fiveRoom === true}
          onChange={state.setBossRoom}
        />
        <SwitchRow
          label={t('dungeon.fiveRoom')}
          hint={t('dungeon.fiveRoom.hint')}
          value={request.fiveRoom === true}
          onChange={state.setFiveRoom}
        />
      </div>
      <SettingsSection title={t('dungeon.tags')}>
        <TagChips picked={request.tags} refused={refusedOf(theme, readTags(request.tags))} onToggle={state.toggleTag} onRandom={state.random} />
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
