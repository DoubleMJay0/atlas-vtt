import { isRecord } from '../utils/guards';
import { DEFAULT_STYLE_PRESET, DEFAULT_VIEW, STYLE_PRESETS, type DungeonStyle, type DungeonView, type StylePresetId } from './style';
import { readDungeonStyle, readDungeonView } from './styleJson';
import { readTags, type DungeonTag } from './tags';

/**
 * The GM's preferences for the dungeon generator, kept in Atlas' settings: how dungeons are drawn
 * and shown, and the tags asked for last. Never a dungeon itself: that becomes a scene.
 */
export interface DungeonGeneratorSettings {
  /** The preset the style started from; `custom` once a field was changed or a palette loaded. */
  preset: StylePresetId | 'custom';
  style: DungeonStyle;
  view: DungeonView;
  tags: DungeonTag[];
}

export const DEFAULT_DUNGEON_GENERATOR_SETTINGS: DungeonGeneratorSettings = {
  preset: DEFAULT_STYLE_PRESET,
  style: STYLE_PRESETS[DEFAULT_STYLE_PRESET],
  view: DEFAULT_VIEW,
  tags: [],
};

function isStylePresetId(value: unknown): value is StylePresetId {
  return typeof value === 'string' && Object.hasOwn(STYLE_PRESETS, value);
}

/** The settings as stored, each field checked; whatever is unreadable takes its default. */
export function readDungeonGeneratorSettings(stored: unknown): DungeonGeneratorSettings {
  const record = isRecord(stored) ? stored : {};
  const preset = isStylePresetId(record.preset) || record.preset === 'custom' ? record.preset : DEFAULT_STYLE_PRESET;
  const base = preset === 'custom' ? STYLE_PRESETS[DEFAULT_STYLE_PRESET] : STYLE_PRESETS[preset];
  return {
    preset,
    style: readDungeonStyle(record.style, base),
    view: readDungeonView(record.view),
    tags: Array.isArray(record.tags) ? readTags(record.tags.filter((tag): tag is string => typeof tag === 'string')) : [],
  };
}
