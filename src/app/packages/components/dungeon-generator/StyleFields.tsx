import React from 'react';
import { STYLE_LIMITS, type DungeonStyle, type HatchingMode } from '../../../dungeons/style';
import type { MessageKey } from '../../../i18n/types';
import { t } from '../../../i18n';
import { ColourRow, NumberRow, SelectRow } from './fields';

export type StyleGroup = 'colors' | 'strokes' | 'shadow' | 'hatching';
export const STYLE_GROUPS: readonly StyleGroup[] = ['colors', 'strokes', 'shadow', 'hatching'];

const COLOURS = [['ink', 'ink'], ['shading', 'shading'], ['water', 'waterColour'], ['floor', 'floor'], ['paper', 'paper']] as const;
const STROKES = [['thin', 'thin', STYLE_LIMITS.strokeThin], ['hatching', 'hatchingStroke', STYLE_LIMITS.strokeHatching], ['normal', 'normal', STYLE_LIMITS.strokeNormal], ['thick', 'thick', STYLE_LIMITS.strokeThick]] as const;
const HATCHING_MODES: readonly HatchingMode[] = ['hatching', 'stonework', 'bricks', 'dots', 'none'];

interface StyleFieldsProps {
  group: StyleGroup;
  style: DungeonStyle;
  onStyle: (style: DungeonStyle) => void;
  layer: HTMLElement | null;
}

/** The fields of one group of the style, each within `STYLE_LIMITS`. */
export function StyleFields({ group, style, onStyle, layer }: StyleFieldsProps): React.JSX.Element {
  const set = <K extends keyof DungeonStyle>(key: K, changes: Partial<DungeonStyle[K]>): void => onStyle({ ...style, [key]: { ...style[key], ...changes } });
  switch (group) {
    case 'colors':
      return <div className="atlas-dungeon-fields">{COLOURS.map(([key, label]) => (
        <ColourRow key={key} label={t(`dungeon.style.${label}`)} value={style.colors[key]} onChange={(value) => set('colors', { [key]: value })} />
      ))}</div>;
    case 'strokes':
      return <div className="atlas-dungeon-fields">{STROKES.map(([key, label, limits]) => (
        <NumberRow key={key} label={t(`dungeon.style.${label}`)} value={style.strokes[key]} limits={limits} step={0.1} onChange={(value) => set('strokes', { [key]: value })} />
      ))}</div>;
    case 'shadow':
      return <div className="atlas-dungeon-fields">
        <ColourRow label={t('dungeon.style.shadowColour')} value={style.shadow.color} onChange={(color) => set('shadow', { color })} />
        <NumberRow label={t('dungeon.style.distance')} value={style.shadow.distance} limits={STYLE_LIMITS.shadowDistance} step={0.05} onChange={(distance) => set('shadow', { distance })} />
      </div>;
    case 'hatching':
      return <div className="atlas-dungeon-fields">
        <SelectRow<HatchingMode>
          label={t('dungeon.style.mode')}
          value={style.hatching.mode}
          options={HATCHING_MODES.map((mode) => ({ value: mode, label: t(`dungeon.style.mode.${mode}` as MessageKey) }))}
          onChange={(mode) => set('hatching', { mode })}
          layer={layer}
        />
        <NumberRow label={t('dungeon.style.hatchingStrokes')} value={style.hatching.strokes} limits={STYLE_LIMITS.hatchingStrokes} step={1} onChange={(strokes) => set('hatching', { strokes: Math.round(strokes) })} />
        <NumberRow label={t('dungeon.style.size')} value={style.hatching.size} limits={STYLE_LIMITS.hatchingSize} step={0.05} onChange={(size) => set('hatching', { size })} />
        <NumberRow label={t('dungeon.style.distance')} value={style.hatching.distance} limits={STYLE_LIMITS.hatchingDistance} step={0.05} onChange={(distance) => set('hatching', { distance })} />
      </div>;
  }
}
