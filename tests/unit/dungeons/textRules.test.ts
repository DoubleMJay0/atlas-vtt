import { describe, expect, it } from 'vitest';
import { pick, rngFrom } from '../../../src/app/dungeons/rng';
import { DUNGEON_TAGS } from '../../../src/app/dungeons/tags';
import { acceptableName, generateName, syllables } from '../../../src/app/dungeons/text/names';
import { NAME_SEEDS } from '../../../src/app/dungeons/text/nameSeeds';
import { tagsFromName } from '../../../src/app/dungeons/text/nameTags';
import { TAG_ADJECTIVE_FLAGS } from '../../../src/app/dungeons/text/rules/titles';
import { pushFacts, tagFlag, TEXT_RULES, textGrammar } from '../../../src/app/dungeons/text/textGrammar';

const FACTS = {
  place: 'catacombs',
  boss: 'the Pale Abbot',
  raider: 'goblin',
  vermin: 'giant rat',
  beast: 'albino cave bear',
  symbol: 'open eye',
  landmark: 'the Hollow Hill',
  wild: 'the Mirewood',
  artefact: 'the silver bell of Ysmar',
  keyLook: 'brass',
};

const OTHER_FLAGS = ['BOSS', 'ENDING', 'CORRIDOR', 'K0', 'K1', 'P_TEMPLE', 'P_TOMB', 'P_FORT', 'P_HOUSE', 'P_LAIR', 'P_MINE', 'P_WATER', 'P_LORE', 'P_PRISON', 'P_CAVE', 'P_WORKS'];

describe('text rules', () => {
  it('every symbol expands under any mix of flags', () => {
    const symbols = Object.keys(TEXT_RULES).filter((key) => !key.includes('?-'));
    for (let seed = 1; seed <= 150; seed++) {
      const rng = rngFrom(seed);
      const flags = [...DUNGEON_TAGS.map(tagFlag), ...OTHER_FLAGS].filter(() => rng() < 0.3);
      flags.push(pick(rng, ['RAIDERS', 'VERMIN', 'BEAST']));
      const tagged = flags.some((flag) => TAG_ADJECTIVE_FLAGS.has(flag));
      if (tagged) flags.push('TAGGED');
      const grammar = textGrammar(rng, flags);
      pushFacts(grammar, FACTS);
      for (const [name, value] of [['side', 'north'], ['sideAdj', 'northern'], ['keyCount', 'three'], ['room', 'hall']]) {
        grammar.push(name as string, value as string);
      }
      for (const symbol of symbols) {
        if (symbol === 'tagAdj' && !tagged) continue;
        const text = grammar.expand(`#${symbol}#`).text;
        expect(text, symbol).not.toMatch(/[#{}[\]]|undefined/);
      }
    }
  });

  it('holds well over a hundred symbols and many hundred alternatives', () => {
    const alternatives = Object.values(TEXT_RULES).reduce((sum, list) => sum + list.length, 0);
    expect(Object.keys(TEXT_RULES).length).toBeGreaterThan(70);
    expect(alternatives).toBeGreaterThan(700);
  });
});

describe('generated names', () => {
  it('are new, sayable and of three or four syllables (or two short parts)', () => {
    const rng = rngFrom(3);
    const names = Array.from({ length: 500 }, () => generateName(rng));
    const seeds = new Set(NAME_SEEDS);
    for (const name of names) {
      expect(name).toMatch(/^[A-Z][a-z]+(-[A-Z][a-z]+)?$/);
      for (const part of name.split('-')) expect(syllables(part)).toBeGreaterThanOrEqual(2);
      if (!name.includes('-')) expect(syllables(name)).toBeLessThanOrEqual(4);
    }
    const fresh = names.filter((name) => !seeds.has(name));
    expect(fresh.length).toBeGreaterThan(480);
    expect(new Set(names).size).toBeGreaterThan(400);
    expect(names.filter((name) => name.includes('-')).length).toBeGreaterThan(60);
  });

  it('rejects rude, unsayable and overlong words', () => {
    expect(acceptableName('vashkill', 3, 4, 10)).toBe(false);
    expect(acceptableName('orvaltitha', 3, 4, 10)).toBe(false);
    expect(acceptableName('strkvane', 2, 4, 10)).toBe(false);
    expect(acceptableName('orvaneshimarath', 3, 4, 10)).toBe(false);
    expect(acceptableName('orvaneth', 3, 4, 10)).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const run = (): string[] => {
      const rng = rngFrom(11);
      return Array.from({ length: 20 }, () => generateName(rng));
    };
    expect(run()).toEqual(run());
  });
});

describe('name tags', () => {
  it('reads tags from whole words, plurals and compounds', () => {
    expect(tagsFromName('Temple of the Weeping Saint')).toEqual(expect.arrayContaining(['ordered', 'temple', 'colonnades']));
    expect(tagsFromName('Lair of the Iron Duke')).toEqual(expect.arrayContaining(['winding', 'treasure', 'dangerous']));
    expect(tagsFromName('Sunken Tombs')).toEqual(expect.arrayContaining(['flooded', 'tomb']));
    expect(tagsFromName('Mirefall Keep')).toEqual(expect.arrayContaining(['wet', 'crumbling', 'square']));
    expect(tagsFromName('Whispering Halls')).not.toContain('round');
  });

  it('resolves rivals in word order', () => {
    const tags = tagsFromName('Dusty Drowned Vaults');
    expect(tags).toContain('flooded');
    expect(tags).not.toContain('dry');
  });
});
