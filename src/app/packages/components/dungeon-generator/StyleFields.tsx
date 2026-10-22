import React, { useId } from 'react';
import { Bold, Italic } from 'lucide-react';
import { Select } from '../primitives/Select';
import { LabelTooltip } from '../primitives/tooltip';
import { STYLE_LIMITS, type DungeonStyle, type FontStyle, type HatchingMode } from '../../../dungeons/style';
import type { MessageKey } from '../../../i18n/types';
import { t } from '../../../i18n';
import { cn } from '../../../../utils/cn';
import { ColourRow, NumberInput, NumberRow, SelectRow } from './fields';

export type StyleGroup = 'colors' | 'strokes' | 'shadow' | 'hatching' | 'text';
export const STYLE_GROUPS: readonly StyleGroup[] = ['colors', 'strokes', 'shadow', 'hatching', 'text'];

const COLOURS = [['ink', 'ink'], ['shading', 'shading'], ['water', 'waterColour'], ['floor', 'floor'], ['paper', 'paper']] as const;
const STROKES = [['thin', 'thin', STYLE_LIMITS.strokeThin], ['hatching', 'hatchingStroke', STYLE_LIMITS.strokeHatching], ['normal', 'normal', STYLE_LIMITS.strokeNormal], ['thick', 'thick', STYLE_LIMITS.strokeThick]] as const;
const HATCHING_MODES: readonly HatchingMode[] = ['hatching', 'stonework', 'bricks', 'dots', 'none'];
const FONTS = ['title', 'story', 'notes', 'legend', 'symbols'] as const;
const FACES: readonly FontStyle['face'][] = ['title', 'text', 'sans', 'serif'];

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
    case 'text':
      return <div className="atlas-dungeon-fields">{FONTS.map((key) => (
        <FontRow key={key} label={t(`dungeon.style.font.${key}`)} font={style.fonts[key]} onChange={(font) => set('fonts', { [key]: font })} layer={layer} />
      ))}</div>;
  }
}

interface FontRowProps {
  label: string;
  font: FontStyle;
  onChange: (font: FontStyle) => void;
  layer: HTMLElement | null;
}

function FontRow({ label, font, onChange, layer }: FontRowProps): React.JSX.Element {
  const id = useId();
  const sizeId = useId();
  const flagButton = (key: 'bold' | 'italic', Icon: typeof Bold): React.JSX.Element => (
    <LabelTooltip label={t(`dungeon.style.${key}`)}>
      <button type="button" className={cn('atlas-dungeon-font__flag', font[key] && 'atlas-active')} aria-pressed={font[key]} onClick={() => onChange({ ...font, [key]: !font[key] })}>
        <Icon />
      </button>
    </LabelTooltip>
  );
  return (
    <div className="atlas-dungeon-field atlas-dungeon-field--stacked">
      <span id={id} className="atlas-dungeon-field__label">{label}</span>
      <div className="atlas-dungeon-font">
        <Select value={font.face} labelledBy={id} layer={layer}
          options={FACES.map((face) => ({ value: face, label: t(`dungeon.style.face.${face}` as MessageKey) }))}
          onChange={(face) => onChange({ ...font, face })} />
        <span id={sizeId} hidden>{t('dungeon.style.size')}</span>
        <NumberInput value={font.size} limits={STYLE_LIMITS.fontSize} step={1} labelledBy={`${id} ${sizeId}`} onChange={(size) => onChange({ ...font, size })} />
        {flagButton('bold', Bold)}
        {flagButton('italic', Italic)}
      </div>
    </div>
  );
}
