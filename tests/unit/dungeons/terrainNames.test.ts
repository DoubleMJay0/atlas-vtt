import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import { TERRAIN_KINDS } from '../../../src/app/dungeons/terrain/catalog';
import { dungeon } from '../../../src/app/i18n/locales/en/dungeon';

/** Every name a piece of terrain carries is an English message, so the GM's label and the note never show a key. */
describe('terrain names', () => {
  const messages: Readonly<Record<string, string>> = dungeon;

  it('name every kind in the catalogue', () => {
    for (const { name } of Object.values(TERRAIN_KINDS)) expect(messages[name], name).toBeTypeOf('string');
  });

  it('name every piece the generator places', () => {
    const names = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const model = generateDungeon({ seed: seed * 911, tags: seed % 2 ? ['wet', 'temple'] : ['crumbling', 'tomb'], floors: 1 + (seed % 4), fiveRoom: seed % 5 === 0 });
      for (const floor of model.floors) for (const piece of floor.terrain) names.add(piece.name);
    }
    expect([...names].filter((name) => typeof messages[name] !== 'string')).toEqual([]);
    expect(names.size).toBeGreaterThan(25);
    // Three hundred dungeons of up to four floors: seconds alone, longer beside the whole suite
  }, 60_000);
});
