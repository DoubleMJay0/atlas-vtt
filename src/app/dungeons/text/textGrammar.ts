/**
 * Builds the grammar every text of a dungeon is written with: all rule files, the dungeon's tags
 * and facts as flags, and its fixed facts pushed as symbols so every mention agrees.
 */

import type { Rng } from '../rng';
import type { DungeonTag } from '../tags';
import { isPlural } from './english';
import { Grammar, type GrammarRules } from './grammar';
import { generateName } from './names';
import { BOSS_RULES } from './rules/bosses';
import { COMMON_RULES } from './rules/common';
import { ENEMY_RULES } from './rules/enemy';
import { ENVIRONMENT_RULES } from './rules/environment';
import { EVENT_RULES } from './rules/events';
import { INHABITANT_RULES } from './rules/inhabitants';
import { LOOT_RULES } from './rules/loot';
import { LOOT_ITEM_RULES } from './rules/lootItems';
import { PASSAGE_RULES } from './rules/passages';
import { STORY_RULES } from './rules/story';
import { TITLE_RULES } from './rules/titles';

export const TEXT_RULES: GrammarRules = {
  ...COMMON_RULES,
  ...TITLE_RULES,
  ...BOSS_RULES,
  ...INHABITANT_RULES,
  ...STORY_RULES,
  ...ENVIRONMENT_RULES,
  ...ENEMY_RULES,
  ...LOOT_RULES,
  ...LOOT_ITEM_RULES,
  ...EVENT_RULES,
  ...PASSAGE_RULES,
};

export type Inhabitants = 'raiders' | 'vermin' | 'beast';

/** The facts a dungeon fixes and pushes as symbols of the same name. */
const FACT_SYMBOLS = ['place', 'boss', 'raider', 'vermin', 'beast', 'symbol', 'landmark', 'wild', 'artefact', 'keyLook'] as const;

export type FactSymbol = (typeof FACT_SYMBOLS)[number];

export function tagFlag(tag: DungeonTag): string {
  return tag.toUpperCase().replace(/-/g, '_');
}

/** Grammar flags for the tags and the facts: BOSS, P_<place kind>, RAIDERS / VERMIN / BEAST. */
export function flagsFor(tags: readonly DungeonTag[], facts: Readonly<Record<string, string>>): string[] {
  const flags = tags.map(tagFlag);
  if (facts.boss) flags.push('BOSS');
  if (facts.placeKind) flags.push(`P_${facts.placeKind.toUpperCase()}`);
  if (facts.inhabitants) flags.push(facts.inhabitants.toUpperCase());
  return flags;
}

export function textGrammar(rng: Rng, flags: Iterable<string>): Grammar {
  return new Grammar(TEXT_RULES, rng, { flags, externals: { Name: () => generateName(rng) } });
}

/** Pushes every fact the dungeon has, and `it`, `itIs` and `its` in agreement with the place noun. */
export function pushFacts(grammar: Grammar, facts: Readonly<Record<string, string>>): void {
  for (const symbol of FACT_SYMBOLS) {
    const value = facts[symbol];
    if (value) grammar.push(symbol, value);
  }
  const place = facts.place;
  if (place) {
    const plural = isPlural(place);
    grammar.push('it', plural ? 'them' : 'it');
    grammar.push('itIs', plural ? 'they are' : 'it is');
    grammar.push('its', plural ? 'their' : 'its');
  }
}

export function popFacts(grammar: Grammar, facts: Readonly<Record<string, string>>): void {
  for (const symbol of FACT_SYMBOLS) if (facts[symbol]) grammar.pop(symbol);
  if (facts.place) {
    grammar.pop('it');
    grammar.pop('itIs');
    grammar.pop('its');
  }
}
