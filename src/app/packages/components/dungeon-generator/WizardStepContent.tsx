import React, { useId } from 'react';
import { MAX_FLOORS } from '../../../dungeons/model';
import { refusedTags } from '../../../dungeons/themes/themes';
import type { ThemeChoice, ThemeId } from '../../../dungeons/themes/themeTypes';
import { type DungeonTag, readTags } from '../../../dungeons/tags';
import type { DungeonStyleId } from '../../../dungeons/styleCatalog';
import { t } from '../../../i18n';
import { Stepper, SwitchRow } from './fields';
import { StyleGallery } from './StyleGallery';
import { FeaturesStep } from './FeaturesStep';
import { ThemeStep } from './ThemeStep';
import type { DungeonState } from './useDungeonState';
import { ViewSettings } from './ViewSettings';
import type { WizardStep } from './wizardSteps';

interface WizardStepContentProps {
  step: WizardStep;
  state: DungeonState;
  /** The style gallery's thumbnails, drawn for the dungeon as shown. */
  thumbnails: ReadonlyMap<DungeonStyleId, ImageBitmap>;
  /** The first style card's art, measured for the size thumbnails are drawn at. */
  onArt: (art: HTMLSpanElement | null) => void;
  /** Each theme's picture of the dungeon asked for. */
  themePreviews: ReadonlyMap<ThemeId, ImageBitmap>;
  /** A theme card's art, measured for the size those pictures are drawn at. */
  onThemeArt: (art: HTMLSpanElement | null) => void;
  /** Enter in the name field creates the scene. */
  onSubmit: () => void;
}

/** The tags the chosen theme refuses, with the reasons as shown; none for Surprise me, which only picks among themes that take them. */
function refusedOf(choice: ThemeChoice, tags: readonly DungeonTag[]): ReadonlyMap<DungeonTag, string> {
  if (choice === 'any') return new Map();
  return new Map([...refusedTags(choice, tags)].map(([tag, reason]) => [tag, t(reason)]));
}

/** What one step of the wizard asks. Every change reaches the preview at once. */
export function WizardStepContent({ step, state, thumbnails, onArt, themePreviews, onThemeArt, onSubmit }: WizardStepContentProps): React.JSX.Element {
  const { request, settings } = state;
  const theme = request.theme ?? 'any';
  switch (step) {
    case 'theme':
      return <ThemeStep value={theme} picked={state.generated?.theme} previews={themePreviews} onArt={onThemeArt} onChange={state.setTheme} />;
    case 'layout':
      return <LayoutStep state={state} />;
    case 'features':
      return <FeaturesStep picked={readTags(request.tags)} refused={refusedOf(theme, readTags(request.tags))} onToggle={state.toggleTag} onChoose={state.chooseTag} />;
    case 'style':
      return (
        <div className="atlas-dungeon-wizard__style">
          <StyleGallery value={settings.style} thumbnails={thumbnails} onChange={state.setStyle} onArt={onArt} />
          <ViewSettings view={settings.view} waterLevel={request.waterLevel} onView={state.setView} onWaterLevel={state.setWaterLevel} />
        </div>
      );
    case 'name':
      return <NameStep name={state.name} onName={state.setName} onSubmit={onSubmit} />;
  }
}

/** Floors, and the boss room and five-room switches; a five-room dungeon has one floor and its boss room. */
function LayoutStep({ state }: { state: DungeonState }): React.JSX.Element {
  const floorsId = useId();
  const { request } = state;
  const fiveRoom = request.fiveRoom === true;
  return (
    <div className="atlas-dungeon-fields">
      <div className="atlas-dungeon-field">
        <span id={floorsId} className="atlas-dungeon-field__label">{t('dungeon.floors')}</span>
        <Stepper
          labelledBy={floorsId}
          value={state.floors}
          min={1}
          max={MAX_FLOORS}
          onChange={state.setFloors}
          fewer={t('dungeon.floors.fewer')}
          more={t('dungeon.floors.more')}
          disabled={fiveRoom}
        />
      </div>
      <SwitchRow
        label={t('dungeon.bossRoom')}
        hint={t('dungeon.bossRoom.hint')}
        value={request.bossRoom !== false || fiveRoom}
        disabled={fiveRoom}
        onChange={state.setBossRoom}
      />
      <SwitchRow label={t('dungeon.fiveRoom')} hint={t('dungeon.fiveRoom.hint')} value={fiveRoom} onChange={state.setFiveRoom} />
    </div>
  );
}

interface NameStepProps {
  name: string;
  onName: (name: string) => void;
  onSubmit: () => void;
}

/** The scene's name, typed or brought from the note pin search; the dungeon does not change with it. */
function NameStep({ name, onName, onSubmit }: NameStepProps): React.JSX.Element {
  const id = useId();
  return (
    <div className="atlas-dungeon-field atlas-dungeon-field--stacked">
      <span id={id} className="atlas-dungeon-field__label">{t('dungeon.name')}</span>
      <input
        type="text"
        className="atlas-dungeon-field__text"
        aria-labelledby={id}
        value={name}
        placeholder={t('dungeon.namePlaceholder')}
        autoFocus
        onChange={(event) => onName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
          event.preventDefault();
          onSubmit();
        }}
      />
    </div>
  );
}
