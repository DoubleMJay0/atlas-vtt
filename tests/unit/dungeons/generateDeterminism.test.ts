import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import { fakeDungeonText } from './fakeDungeonText';

describe('generateDungeon', () => {
  it('gives the same dungeon for the same request', () => {
    for (const tags of [[], ['large', 'ordered', 'wet'], ['small', 'string'], ['secret', 'multi-level', 'round']]) {
      const request = { seed: 424242, tags };
      expect(generateDungeon(request, fakeDungeonText())).toEqual(generateDungeon(request, fakeDungeonText()));
    }
  });

  it('keeps rooms, doors and columns where they are when only the words change', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const request = { seed, tags: ['temple', 'colonnades'] };
      const a = generateDungeon(request, fakeDungeonText('A'));
      const b = generateDungeon(request, fakeDungeonText('B'));
      expect(b.title).not.toBe(a.title);
      expect(b.rooms).toEqual(a.rooms);
      expect(b.doors).toEqual(a.doors);
      expect(b.columns).toEqual(a.columns);
    }
  });

  it('gives other seeds other dungeons', () => {
    const a = generateDungeon({ seed: 1, tags: [] }, fakeDungeonText());
    const b = generateDungeon({ seed: 2, tags: [] }, fakeDungeonText());
    expect(b.rooms).not.toEqual(a.rooms);
  });

  it('starts at an entrance in (0, 0)', () => {
    const model = generateDungeon({ seed: 9, tags: [] }, fakeDungeonText());
    const entrance = model.doors[0];
    expect(entrance).toMatchObject({ x: 0, y: 0, kind: 'entrance', from: null, to: 0 });
  });

  it('follows the water level the GM asks for', () => {
    const dry = generateDungeon({ seed: 5, tags: ['flooded'], waterLevel: 0 }, fakeDungeonText());
    const wet = generateDungeon({ seed: 5, tags: ['dry'], waterLevel: 0.7 }, fakeDungeonText());
    expect(dry.waterCells.length).toBeLessThan(wet.waterCells.length);
    expect(wet.water.length).toBeGreaterThan(0);
    wet.water.forEach((pool) => expect(pool.outline.length).toBeGreaterThan(5));
  });
});
