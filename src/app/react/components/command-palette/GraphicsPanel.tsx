import React from 'react';
import { Button } from '../../../packages/components/primitives/button';
import { SegmentedControl, type SegmentedOption } from '../../../packages/components/primitives/SegmentedControl';
import { t } from '../../../i18n';
import { useAtlasSettings } from '../../../keyboard/useMapHotkeys';
import { lightingQualityChoices, presetLabel } from '../../../lighting/lightingQualityChoices';
import { choicesOf, knobsOf, presetOf, TRACED_KNOBS, withKnob, type GraphicsKnob, type GraphicsKnobs } from '../../../lighting/graphicsSettings';
import { isLightingQualityLevel, type LightingQualityLevel } from '../../../lighting/lightingQuality';
import type { SettingsService } from '../../../services/SettingsService';
import { SettingChoiceRow } from './SettingRows';

/** A knob's row: under which heading it stands, how it is named and explained, and what each of its choices is called. */
interface KnobRow<K extends GraphicsKnob> {
  readonly knob: K;
  readonly group: 'lighting' | 'animated' | 'screen';
  readonly label: () => string;
  readonly hint: () => string;
  readonly name: (value: GraphicsKnobs[K]) => string;
}

const KNOB_ROWS: readonly KnobRow<GraphicsKnob>[] = [
  { knob: 'picture', group: 'lighting', label: () => t('graphics.picture'), hint: () => t('graphics.pictureHint'), name: (value) => (value === 'traced' ? t('graphics.traced') : t('graphics.polygons')) },
  { knob: 'detail', group: 'lighting', label: () => t('graphics.detail'), hint: () => t('graphics.detailHint'), name: (value) => t(`graphics.${String(value)}` as 'graphics.fine') },
  { knob: 'bounce', group: 'lighting', label: () => t('graphics.bounce'), hint: () => t('graphics.bounceHint'), name: (value) => (value === 'all' ? t('graphics.bounceAll') : value === 'smaller' ? t('graphics.bounceSmaller') : t('graphics.bounceOff')) },
  { knob: 'flames', group: 'lighting', label: () => t('graphics.flames'), hint: () => t('graphics.flamesHint'), name: (value) => (value === 'lively' ? t('graphics.lively') : t('graphics.calm')) },
  { knob: 'shadows', group: 'lighting', label: () => t('graphics.shadows'), hint: () => t('graphics.shadowsHint'), name: (value) => t(`graphics.${String(value)}` as 'graphics.fine') },
  { knob: 'liquids', group: 'animated', label: () => t('graphics.liquids'), hint: () => t('graphics.liquidsHint'), name: (value) => t('graphics.perSecond', { count: Number(value) }) },
  { knob: 'litMap', group: 'screen', label: () => t('graphics.litMap'), hint: () => t('graphics.litMapHint'), name: (value) => (value === 'sharp' ? t('graphics.sharp') : t('graphics.standard')) },
] as readonly KnobRow<GraphicsKnob>[];

type PresetTab = LightingQualityLevel | 'custom';

/** The presets as tabs, with Custom lighting up on its own once a knob below differs from the chosen preset. */
function presetOptions(custom: boolean): SegmentedOption<PresetTab>[] {
  return [...lightingQualityChoices(), { value: 'custom', label: t('graphics.custom'), hint: t('graphics.customHint'), disabled: !custom }];
}

/**
 * The Graphics page of the command palette: the three presets as tabs, and below them every choice
 * a preset makes, each its own row, so one thing can be set away from a preset (`GraphicsChoice`).
 * The knobs only the traced picture reads stay in place, disabled, while the picture is polygons.
 * The choice is this device's (`SettingsService.getGraphics`).
 */
export function GraphicsPanel(): React.ReactElement {
  const settings = useAtlasSettings();
  if (!settings) return <div className="atlas-command-palette-panel" />;
  return <GraphicsRows settings={settings} />;
}

function GraphicsRows({ settings }: { settings: SettingsService }): React.ReactElement {
  const choice = settings.getGraphics();
  const knobs = knobsOf(choice);
  const preset = presetOf(knobs);
  const picked = settings.isLightingQualityPicked();
  const polygons = knobs.picture === 'polygons';
  const rows = (group: KnobRow<GraphicsKnob>['group']): React.ReactElement[] => KNOB_ROWS.filter((row) => row.group === group).map((row) => {
    const inert = polygons && TRACED_KNOBS.includes(row.knob);
    const options = choicesOf(row.knob).map((value): SegmentedOption<string> => ({ value: String(value), label: row.name(value) }));
    return (
      <SettingChoiceRow key={row.knob} label={row.label()} hint={inert ? t('graphics.tracedOnly') : row.hint()}>
        <SegmentedControl<string>
          value={String(knobs[row.knob])}
          options={options}
          ariaLabel={row.label()}
          disabled={inert}
          onChange={(value) => {
            const chosen = choicesOf(row.knob).find((candidate) => String(candidate) === value);
            if (chosen !== undefined) settings.setGraphics(withKnob(choice, row.knob, chosen));
          }}
        />
      </SettingChoiceRow>
    );
  });
  return (
    <div className="atlas-command-palette-panel atlas-graphics">
      <div className="atlas-command-palette-panel-column">
        <h3 className="atlas-command-palette-panel-heading">{t('graphics.preset')}</h3>
        <SettingChoiceRow label={t('graphics.presetLabel')} hint={t('graphics.presetHint')}>
          <SegmentedControl<PresetTab>
            value={preset ?? 'custom'}
            options={presetOptions(preset === null)}
            ariaLabel={t('graphics.preset')}
            onChange={(tab) => { if (isLightingQualityLevel(tab)) settings.setLightingQuality(tab); }}
          />
        </SettingChoiceRow>
        <div className="atlas-graphics__picked">
          {picked && preset !== null
            ? <span className="atlas-setting-hint">{t('graphics.picked', { level: presetLabel(preset) })}</span>
            : <Button variant="ghost" size="sm" onClick={() => settings.resetGraphics()}>{t('graphics.reset')}</Button>}
        </div>
        <h3 className="atlas-command-palette-panel-heading">{t('graphics.animated')}</h3>
        {rows('animated')}
        <h3 className="atlas-command-palette-panel-heading">{t('graphics.screen')}</h3>
        {rows('screen')}
      </div>
      <div className="atlas-command-palette-panel-column">
        <h3 className="atlas-command-palette-panel-heading">{t('graphics.lighting')}</h3>
        {rows('lighting')}
      </div>
    </div>
  );
}
