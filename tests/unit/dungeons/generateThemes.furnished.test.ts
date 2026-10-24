import { describe, expect, it, vi } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import type { DungeonModel } from '../../../src/app/dungeons/model';
import { clearanceProblems, routeProblems, stairClearanceProblems } from './terrainInvariants';

/**
 * Themed dungeons with every furniture kind offered, as they will be once every kind has its
 * drawing: what the recipes place must keep every way through a floor open and every door and
 * stair approach clear, and chests stand only as storage.
 */
vi.mock('../../../src/app/dungeons/drawnKinds', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/app/dungeons/drawnKinds')>();
  const { ALL_PROP_KINDS } = await import('../../../src/app/dungeons/props/propKinds');
  return { ...original, DRAWN_PROP_KINDS: ALL_PROP_KINDS };
});

const TAG_SETS: readonly string[][] = [[], ['small'], ['large'], ['secret', 'round'], ['crumbling', 'overgrown']];
const BEDS = new Set(['bed', 'bunk', 'cot', 'four-poster-bed']);
const STORAGE = new Set(['storeroom', 'attic-room', 'nursery']);

describe.each(['fortress', 'mansion'] as const)('furnished %s dungeons', (theme) => {
  const runs = Array.from({ length: 200 }, (_, k) => {
    const seed = (k + 1) * 6007;
    const tags = TAG_SETS[k % TAG_SETS.length] ?? [];
    return { seed, tags, model: generateDungeon({ seed, theme, tags, floors: 1 + (k % 3) }) };
  });
  const failures = (check: (model: DungeonModel) => string[]): string[] => runs.flatMap((run) => check(run.model).map((p) => `seed ${run.seed} [${run.tags.join(',')}]: ${p}`)).slice(0, 10);

  it('furnishes its rooms', () => {
    const props = runs.reduce((sum, run) => sum + run.model.floors.reduce((s, f) => s + f.props.length, 0), 0);
    expect(props / runs.length).toBeGreaterThan(10);
  });

  it('keeps every way through, every door and stair approach clear of its furniture', () => {
    expect(failures((m) => m.floors.flatMap((floor, i) => [...routeProblems(floor), ...clearanceProblems(floor, i), ...stairClearanceProblems(floor, i)].map((p) => `floor ${i}: ${p}`)))).toEqual([]);
  });

  it('puts a chest only at a bed\'s foot or in a storeroom', () => {
    expect(failures((m) => m.floors.flatMap((floor) => floor.props.filter((p) => p.kind === 'chest').flatMap((chest) => {
      const type = floor.rooms[chest.room]?.type ?? '';
      const byBed = floor.props.some((p) => p.room === chest.room && BEDS.has(p.kind) && Math.hypot(p.x - chest.x, p.y - chest.y) <= 1.8);
      return STORAGE.has(type) || byBed ? [] : [`a chest in a ${type}`];
    })))).toEqual([]);
  });
});
