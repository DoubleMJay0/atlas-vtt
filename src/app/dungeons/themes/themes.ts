/**
 * The themes a dungeon can have, one per dungeon: which a GM's choice (or Any, by the seed) gives,
 * the tags each cannot take, and the programme it types its rooms by.
 */

import { pick, stream } from '../rng';
import type { DungeonTag } from '../tags';
import type { MessageKey } from '../../i18n';
import { CAVERN } from './cavern';
import { FORTRESS } from './fortress';
import { MANSION } from './mansion';
import { THEME_IDS, type RoomProgramme, type ThemeChoice, type ThemeDefinition, type ThemeFacts, type ThemeId } from './themeTypes';

const NO_MOLTEN: readonly { tag: DungeonTag; reason: MessageKey }[] = [
  { tag: 'lava', reason: 'dungeon.theme.refused.noMolten' },
  { tag: 'acid', reason: 'dungeon.theme.refused.noMolten' },
];

export const THEMES: Readonly<Record<ThemeId, ThemeDefinition>> = {
  // A gate passage three cells long holds two murder holes a cell apart.
  fortress: { id: 'fortress', built: true, rise: 'up', stairsFromEntrance: true, entranceDepth: 5, refuses: NO_MOLTEN, programme: FORTRESS },
  mansion: { id: 'mansion', built: true, rise: 'up', stairsFromEntrance: true, refuses: [...NO_MOLTEN, { tag: 'flooded', reason: 'dungeon.theme.refused.noFlooding' }], programme: MANSION },
  cavern: CAVERN,
};

export function themeOf(id: ThemeId): ThemeDefinition {
  return THEMES[id];
}

/** The tags a theme cannot take beside `tags`, each with the reason the panel shows. */
export function refusedTags(theme: ThemeId, tags: readonly DungeonTag[] = []): ReadonlyMap<DungeonTag, MessageKey> {
  return new Map(THEMES[theme].refuses.filter((r) => r.with === undefined || tags.includes(r.with)).map(({ tag, reason }) => [tag, reason]));
}

/** `tags` without those the theme refuses: a tag a theme cannot take is ignored for it. */
export function themedTags(theme: ThemeId, tags: readonly DungeonTag[]): DungeonTag[] {
  const refused = refusedTags(theme, tags);
  return tags.filter((tag) => !refused.has(tag));
}

/**
 * The dungeon's theme: the chosen one, or for Any one of the themes that take every chosen tag (any
 * theme where none takes them all), by the seed alone. The roll is made whatever the choice.
 */
export function pickTheme(seed: number, choice: ThemeChoice, tags: readonly DungeonTag[]): ThemeId {
  const takers = THEME_IDS.filter((id) => themedTags(id, tags).length === tags.length);
  const rolled = pick(stream(seed, 'layout', 'theme'), takers.length ? takers : THEME_IDS);
  return choice === 'any' ? rolled : choice;
}

/** A stored or typed theme choice; anything Atlas does not know reads as Any. */
export function readThemeChoice(value: unknown): ThemeChoice {
  return value === 'any' || (THEME_IDS as readonly unknown[]).includes(value) ? (value as ThemeChoice) : 'any';
}

/** The programme a theme types its rooms by for these tags. */
export function programmeOf(definition: ThemeDefinition, tags: ReadonlySet<DungeonTag>): RoomProgramme {
  return definition.programmeFor?.(tags) ?? definition.programme;
}

/** A theme that knows nothing of its rooms beyond the layout: allows everything, scores nothing, vetoes nothing. */
export const NO_FACTS: ThemeFacts = {
  allows: () => true,
  score: () => 0,
  placeAllowed: () => true,
  richness: () => 1,
};

/** What terrain and furnishing know of the dungeon's theme. */
export interface ThemeContext {
  definition: ThemeDefinition;
  ruined: boolean;
  facts: ThemeFacts;
}
