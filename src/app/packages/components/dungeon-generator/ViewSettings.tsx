import React, { useId } from 'react';
import { Button } from '../primitives/button';
import { Slider } from '../primitives/slider';
import { GRID_STYLES, NOTES_MODES } from '../../../dungeons/styleJson';
import type { DungeonView, GridStyle, NotesMode } from '../../../dungeons/style';
import type { MessageKey } from '../../../i18n/types';
import { t } from '../../../i18n';
import { SelectRow, SwitchRow } from './fields';

type ViewSwitch = Exclude<keyof DungeonView, 'grid' | 'notes' | 'smallTiles' | 'water'>;

/** The layers and fits a switch turns on and off, in the order shown. */
const SWITCHES: readonly ViewSwitch[] = ['props', 'shadow', 'exits', 'titleAndStory', 'secrets', 'monochrome', 'rotateToFit', 'zoomToFit'];

interface ViewSettingsProps {
  view: DungeonView;
  /** 0..1, or undefined while the tags decide. */
  waterLevel: number | undefined;
  onView: (changes: Partial<DungeonView>) => void;
  onWaterLevel: (level: number | undefined) => void;
  layer: HTMLElement | null;
}

/** What the page shows: grid, water, props and the other layers. */
export function ViewSettings({ view, waterLevel, onView, onWaterLevel, layer }: ViewSettingsProps): React.JSX.Element {
  const levelId = useId();
  const level = waterLevel ?? null;
  return (
    <div className="atlas-dungeon-fields">
      <SelectRow<GridStyle>
        label={t('dungeon.view.grid')}
        value={view.grid}
        options={GRID_STYLES.map((grid) => ({ value: grid, label: t(`dungeon.view.grid.${grid}` as MessageKey) }))}
        onChange={(grid) => onView({ grid })}
        layer={layer}
      />
      <SwitchRow label={t('dungeon.view.smallTiles')} value={view.smallTiles} disabled={view.grid === 'off'} onChange={(smallTiles) => onView({ smallTiles })} />
      <SwitchRow label={t('dungeon.view.water')} value={view.water} onChange={(water) => onView({ water })} />
      <div className="atlas-dungeon-field atlas-dungeon-field--stacked">
        <div className="atlas-dungeon-field__line">
          <span id={levelId} className="atlas-dungeon-field__label">{t('dungeon.view.waterLevel')}</span>
          {level === null
            ? <span className="atlas-dungeon-field__value">{t('dungeon.view.waterByTags')}</span>
            : <Button variant="ghost" size="sm" className="atlas-dungeon-field__reset" onClick={() => onWaterLevel(undefined)}>{t('dungeon.view.waterByTags')}</Button>}
        </div>
        <Slider
          aria-labelledby={levelId}
          min={0}
          max={1}
          step={0.1}
          value={[level ?? 0]}
          disabled={!view.water}
          getValueText={(value) => value.toFixed(1)}
          onValueChange={([value]) => onWaterLevel(value)}
        />
      </div>
      {SWITCHES.map((key) => (
        <SwitchRow key={key} label={t(`dungeon.view.${key}` as MessageKey)} value={view[key]} onChange={(on) => onView({ [key]: on })} />
      ))}
    </div>
  );
}

interface NotesSettingsProps {
  mode: NotesMode;
  onMode: (notes: NotesMode) => void;
  onRearrange: () => void;
  onReroll: () => void;
  layer: HTMLElement | null;
}

/** How the notes are shown, another arrangement of their boxes, and other words for them. */
export function NotesSettings({ mode, onMode, onRearrange, onReroll, layer }: NotesSettingsProps): React.JSX.Element {
  const boxed = mode === 'boxes' || mode === 'tailed';
  const written = boxed || mode === 'legend';
  return (
    <div className="atlas-dungeon-fields">
      <SelectRow<NotesMode>
        label={t('dungeon.notes')}
        value={mode}
        options={NOTES_MODES.map((notes) => ({ value: notes, label: t(`dungeon.notes.${notes}` as MessageKey) }))}
        onChange={onMode}
        layer={layer}
      />
      <div className="atlas-dungeon-fields__buttons">
        <Button variant="outline" size="sm" disabled={!boxed} onClick={onRearrange}>{t('dungeon.notes.rearrange')}</Button>
        <Button variant="outline" size="sm" disabled={!written} onClick={onReroll}>{t('dungeon.notes.reroll')}</Button>
      </div>
    </div>
  );
}
