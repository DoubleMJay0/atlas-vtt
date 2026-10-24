import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import { canonicalJson, hashText } from '../../../src/app/utils/hashing';
import baseline from './caveTerrainBaseline.json';

/** Caverns keep going down: while floors learn to rise, a Cavern stays what it was (hashes written from the themes-core code). */
describe('a Cavern while floors rise', () => {
  it("keeps a Cavern's terrain as before", () => {
    const changed: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const model = generateDungeon({ seed: seed * 104729, tags: [], floors: 3, theme: 'cavern' });
      const was = (baseline as Record<string, { terrain: string; model: string }>)[seed];
      if (hashText(canonicalJson(model.floors.map((f) => f.terrain))) !== was?.terrain || hashText(canonicalJson(model)) !== was.model) changed.push(seed);
    }
    expect(changed).toEqual([]);
  });
});
