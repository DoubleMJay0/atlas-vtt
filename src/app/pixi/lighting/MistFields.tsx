import React, { useState } from 'react';
import { DEFAULT_MIST_COLOR, DEFAULT_MIST_DENSITY, DEFAULT_MIST_SPEED, MAX_MIST_SPEED, mistOf } from '../../lighting/sceneLightingOptions';
import type { SceneLighting, SceneLightingChanges } from '../../types/lightingTypes';
import { ColorField, SliderField, ToggleField } from './lightingPanelFields';
import { t } from '../../i18n';

interface MistFieldsProps {
  lighting: SceneLighting;
  setSceneLighting: (changes: SceneLightingChanges) => void;
}

/**
 * The scene's mist over what the players do not see now: on or off, how thick, how fast, which
 * way it drifts and its colour. Off, its settings stay in place, disabled, so the panel keeps its shape.
 */
export function MistFields({ lighting, setSceneLighting }: MistFieldsProps): React.ReactElement {
  const mist = mistOf(lighting);
  const off = mist === null;
  // Each slider shows its value live while dragged and reaches the scene on release, as one change.
  const [density, setDensity] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const shownDensity = density ?? Math.round((mist?.density ?? DEFAULT_MIST_DENSITY) * 100);
  const shownSpeed = speed ?? Math.round((mist?.speed ?? DEFAULT_MIST_SPEED) * 100);
  const shownAngle = angle ?? Math.round(mist?.angle ?? 0);
  return (
    <>
      <ToggleField
        label={t('sceneLight.mist')}
        value={!off}
        tooltipOn={t('sceneLight.mistOn')}
        tooltipOff={t('sceneLight.mistOff')}
        // Off is the default and is stored as no choice at all.
        onChange={(on) => setSceneLighting({ unexploredMist: on ? true : undefined })}
      />
      <SliderField label={t('sceneLight.mistDensity')} value={shownDensity} min={0} max={100} step={1} display={`${shownDensity} %`} disabled={off}
        onChange={setDensity}
        onCommit={(percent) => {
          setDensity(null);
          setSceneLighting({ unexploredMistDensity: percent / 100 });
        }} />
      <SliderField label={t('sceneLight.mistSpeed')} value={shownSpeed} min={0} max={MAX_MIST_SPEED * 100} step={5} display={`${shownSpeed} %`} disabled={off}
        onChange={setSpeed}
        onCommit={(percent) => {
          setSpeed(null);
          setSceneLighting({ unexploredMistSpeed: percent / 100 });
        }} />
      <SliderField label={t('sceneLight.mistAngle')} value={shownAngle} min={0} max={359} step={1} display={`${shownAngle}°`} disabled={off}
        onChange={setAngle}
        onCommit={(degrees) => {
          setAngle(null);
          setSceneLighting({ unexploredMistAngle: degrees });
        }} />
      <ColorField label={t('sceneLight.mistColour')} value={mist?.color ?? DEFAULT_MIST_COLOR}
        onChange={(unexploredMistColor) => setSceneLighting({ unexploredMistColor })} />
    </>
  );
}
