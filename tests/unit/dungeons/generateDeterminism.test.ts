import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';

describe('generateDungeon', () => {
  it('gives the same dungeon for the same request', () => {
    for (const tags of [[], ['large', 'ordered', 'wet'], ['small', 'string'], ['secret', 'multi-level', 'round']]) {
      const request = { seed: 424242, tags };
      expect(generateDungeon(request)).toEqual(generateDungeon(request));
    }
  });

  it('holds no text: a dungeon is named by the GM alone', () => {
    const model = generateDungeon({ seed: 77, tags: ['temple'] });
    expect(Object.keys(model).sort()).toEqual(['columns', 'cracks', 'doors', 'props', 'rooms', 'rubble', 'seed', 'tags', 'version', 'water', 'waterCells']);
  });

  it('gives other seeds other dungeons', () => {
    const a = generateDungeon({ seed: 1, tags: [] });
    const b = generateDungeon({ seed: 2, tags: [] });
    expect(b.rooms).not.toEqual(a.rooms);
  });

  it('starts at an entrance in (0, 0)', () => {
    const model = generateDungeon({ seed: 9, tags: [] });
    const entrance = model.doors[0];
    expect(entrance).toMatchObject({ x: 0, y: 0, kind: 'entrance', from: null, to: 0 });
  });

  it('follows the water level the GM asks for', () => {
    const dry = generateDungeon({ seed: 5, tags: ['flooded'], waterLevel: 0 });
    const wet = generateDungeon({ seed: 5, tags: ['dry'], waterLevel: 0.7 });
    expect(dry.waterCells.length).toBeLessThan(wet.waterCells.length);
    expect(wet.water.length).toBeGreaterThan(0);
    wet.water.forEach((pool) => expect(pool.outline.length).toBeGreaterThan(5));
  });
});
