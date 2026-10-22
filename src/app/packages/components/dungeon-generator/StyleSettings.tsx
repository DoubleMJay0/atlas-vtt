import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '../primitives/button';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { STYLE_PRESETS, type DungeonStyle, type StylePresetId } from '../../../dungeons/style';
import { readPaletteFile } from '../../../dungeons/styleJson';
import type { MessageKey } from '../../../i18n/types';
import { showNotice } from '../../../ui/notice';
import { t } from '../../../i18n';
import { SelectRow } from './fields';
import { STYLE_GROUPS, StyleFields, type StyleGroup } from './StyleFields';

/** A palette file is a few hundred bytes; anything far larger is no palette. */
const MAX_PALETTE_BYTES = 64 * 1024;

type PresetChoice = StylePresetId | 'custom';
const PRESETS = Object.keys(STYLE_PRESETS) as StylePresetId[];

interface StyleSettingsProps {
  preset: PresetChoice;
  style: DungeonStyle;
  onStyle: (style: DungeonStyle) => void;
  onPreset: (preset: StylePresetId) => void;
  /** Saves the style as a palette file. */
  onSavePalette: () => void;
  layer: HTMLElement | null;
}

/** Reads a palette file the GM picked; null with a notice when it is none. */
export async function readPaletteUpload(file: File): Promise<DungeonStyle | null> {
  const style = file.size <= MAX_PALETTE_BYTES ? readPaletteFile(await file.text()) : null;
  if (!style) showNotice(t('dungeon.style.notPalette', { name: file.name }));
  return style;
}

/** How the dungeon is drawn: a preset, then colours, strokes, shadow, hatching and fonts. */
export function StyleSettings({ preset, style, onStyle, onPreset, onSavePalette, layer }: StyleSettingsProps): React.JSX.Element {
  const [group, setGroup] = useState<StyleGroup>('colors');
  const fileInput = useRef<HTMLInputElement>(null);
  const choices: PresetChoice[] = preset === 'custom' ? [...PRESETS, 'custom'] : PRESETS;

  const load = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const loaded = await readPaletteUpload(file);
    if (loaded) onStyle(loaded);
  };

  return (
    <div className="atlas-dungeon-fields">
      <SelectRow<PresetChoice>
        label={t('dungeon.style.preset')}
        value={preset}
        options={choices.map((id) => ({ value: id, label: t(`dungeon.style.preset.${id}` as MessageKey) }))}
        onChange={(id) => { if (id !== 'custom') onPreset(id); }}
        layer={layer}
      />
      <SegmentedControl<StyleGroup>
        className="atlas-dungeon-style__groups"
        value={group}
        roving
        ariaLabel={t('dungeon.style')}
        options={STYLE_GROUPS.map((value) => ({ value, label: t(`dungeon.style.${value}` as MessageKey) }))}
        onChange={setGroup}
      />
      <StyleFields group={group} style={style} onStyle={onStyle} layer={layer} />
      <div className="atlas-dungeon-style__files">
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload />
          <span>{t('dungeon.style.load')}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onSavePalette}>
          <Download />
          <span>{t('dungeon.style.save')}</span>
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void load(file);
          }}
        />
      </div>
    </div>
  );
}
