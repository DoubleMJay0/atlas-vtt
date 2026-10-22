import { isRecord } from '../utils/guards';
import { DEFAULT_VIEW, GRID_STYLES, type DungeonView } from './style';
import { DEFAULT_STYLE_ID, isDungeonStyleId, type DungeonStyleId } from './styleCatalog';
import { readTags, type DungeonTag } from './tags';

/**
 * The GM's preferences for the dungeon generator, kept in Atlas' settings: the style dungeons are
 * drawn in, what they show, and the tags asked for last. Never a dungeon itself: that becomes a scene.
 */
export interface DungeonGeneratorSettings {
  /** The look picked in the gallery, by id. */
  style: DungeonStyleId;
  view: DungeonView;
  tags: DungeonTag[];
}

export const DEFAULT_DUNGEON_GENERATOR_SETTINGS: DungeonGeneratorSettings = {
  style: DEFAULT_STYLE_ID,
  view: DEFAULT_VIEW,
  tags: [],
};

function oneOf<T extends string>(value: unknown, options: readonly T[], base: T): T {
  return options.includes(value as T) ? (value as T) : base;
}

function flag(value: unknown, base: boolean): boolean {
  return typeof value === 'boolean' ? value : base;
}

/** A view from stored data, over the defaults field by field; fields of older versions are left behind. */
export function readDungeonView(value: unknown, base: DungeonView = DEFAULT_VIEW): DungeonView {
  const record = isRecord(value) ? value : {};
  return {
    grid: oneOf(record.grid, GRID_STYLES, base.grid),
    smallTiles: flag(record.smallTiles, base.smallTiles),
    water: flag(record.water, base.water),
    props: flag(record.props, base.props),
    shadow: flag(record.shadow, base.shadow),
    exits: flag(record.exits, base.exits),
    secrets: flag(record.secrets, base.secrets),
    monochrome: flag(record.monochrome, base.monochrome),
  };
}

/**
 * The settings as stored, each field checked; whatever is unreadable takes its default. A style
 * Atlas does not know (a newer version's, or the colours an earlier build let the GM edit) is the
 * default style.
 */
export function readDungeonGeneratorSettings(stored: unknown): DungeonGeneratorSettings {
  const record = isRecord(stored) ? stored : {};
  return {
    style: isDungeonStyleId(record.style) ? record.style : DEFAULT_STYLE_ID,
    view: readDungeonView(record.view),
    tags: Array.isArray(record.tags) ? readTags(record.tags.filter((tag): tag is string => typeof tag === 'string')) : [],
  };
}
