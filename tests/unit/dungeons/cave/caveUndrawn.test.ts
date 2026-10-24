import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../../src/app/dungeons/generate';

const CAVE_FLOOR_KINDS = new Set(['guano', 'bone-litter', 'sulphur-crust', 'rimstone', 'boulder-choke']);
const SETS: string[][] = [[], ['acid'], ['wet'], ['lava', 'deep'], ['flooded']];

describe('a cave\'s floor textures without their drawings', () => {
  it('places none of them', () => {
    const found = new Set<string>();
    for (let floors = 1; floors <= 3; floors++) {
      for (let k = 1; k <= 200; k++) {
        const model = generateDungeon({ seed: k * 7_717 + floors, theme: 'cavern', tags: SETS[k % SETS.length]!, floors });
        for (const floor of model.floors) for (const piece of floor.terrain) if (CAVE_FLOOR_KINDS.has(piece.kind)) found.add(piece.kind);
      }
    }
    expect([...found]).toEqual([]);
  }, 600_000);
});
