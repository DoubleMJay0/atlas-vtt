import { describe, expect, it } from 'vitest';
import { type RecipeContext, furnishByRecipe } from '../../../src/app/dungeons/props/recipe';
import { ALL_PROP_KINDS } from '../../../src/app/dungeons/props/propKinds';
import { FORTRESS } from '../../../src/app/dungeons/themes/fortress';
import type { RoomTypeSpec } from '../../../src/app/dungeons/themes/themeTypes';
import { furnished } from './furnishFixtures';

const spec = (id: string): RoomTypeSpec => FORTRESS.rooms.find((s) => s.id === id)!;
const CONTEXT: RecipeContext = { depthRank: 0.5, ruined: false, sheeted: 0, richness: 1 };

function furnishedRoom(id: string, w: number, h: number, seed: number, context: Partial<RecipeContext> = {}, offered = ALL_PROP_KINDS) {
  const fs = furnished(w, h, { seed, offered });
  const props = furnishByRecipe(fs, spec(id).furnish, { ...CONTEXT, ...context });
  return { fs, props };
}

const mean = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0) / values.length;

describe('furnishing by recipe', () => {
  it('places the defining piece first', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const kitchen = furnishedRoom('kitchen', 5, 4, seed);
      expect(kitchen.props[0]?.kind, `seed ${seed}`).toBe('range');
      const solar = furnishedRoom('solar', 5, 5, seed);
      expect(solar.props[0]?.kind, `seed ${seed}`).toBe('bed');
      expect(solar.props[1]?.kind, `seed ${seed}`).toBe('chest');
      const bed = solar.fs.placed[0]!;
      const chest = solar.props[1]!;
      expect(bed.cells.some((c) => Math.abs(c.x + 0.5 - chest.x) + Math.abs(c.y + 0.5 - chest.y) <= 1.5), `seed ${seed}`).toBe(true);
    }
  });

  it('gives deeper rooms of a type more of their optional pieces', () => {
    const seeds = Array.from({ length: 200 }, (_, k) => k + 1);
    const at = (depthRank: number): number => mean(seeds.map((seed) => furnishedRoom('solar', 7, 6, seed, { depthRank }).props.length));
    expect(at(1)).toBeGreaterThan(at(0));
  });

  it('skips a piece it is not offered and keeps the room bare without its defining piece', () => {
    const offered = new Set([...ALL_PROP_KINDS].filter((kind) => kind !== 'range'));
    const kitchen = furnishedRoom('kitchen', 5, 4, 3, {}, offered);
    expect(kitchen.props).toEqual([]);
    const noShelves = new Set([...ALL_PROP_KINDS].filter((kind) => kind !== 'shelves'));
    expect(furnishedRoom('kitchen', 5, 4, 3, {}, noShelves).props.some((p) => p.kind === 'shelves')).toBe(false);
  });

  it('scales optional pieces by richness', () => {
    const seeds = Array.from({ length: 200 }, (_, k) => k + 1);
    const runs = (richness: number) => seeds.map((seed) => furnishedRoom('solar', 7, 6, seed, { richness }).props);
    const poor = runs(0.3);
    const rich = runs(1);
    expect(mean(poor.map((p) => p.length))).toBeLessThan(mean(rich.map((p) => p.length)));
    expect(poor.every((p) => p[0]?.kind === 'bed')).toBe(true);
  });

  it('puts dust sheets over a haunted room\'s optional pieces', () => {
    const seeds = Array.from({ length: 100 }, (_, k) => k + 1);
    const sheets = seeds.flatMap((seed) => furnishedRoom('solar', 7, 6, seed, { sheeted: 0.5 }).props).filter((p) => p.kind === 'dust-sheet');
    expect(sheets.length).toBeGreaterThan(0);
    expect(seeds.flatMap((seed) => furnishedRoom('solar', 7, 6, seed).props).some((p) => p.kind === 'dust-sheet')).toBe(false);
  });
});
