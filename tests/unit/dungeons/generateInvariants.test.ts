import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import type { DungeonModel } from '../../../src/app/dungeons/model';
import { bypasses, doorProblems, floorProblems, rotundaProblems, unreachableRooms } from './dungeonInvariants';

const SEEDS = 500;

/** Tag sets cycled over the seeds, each with every size. */
const COMBOS: readonly string[][] = [
  [],
  ['ordered', 'temple', 'colonnades'],
  ['chaotic', 'winding', 'wet'],
  ['string', 'deep', 'flooded'],
  ['secret', 'round', 'backdoor', 'multi-level'],
  ['no-secrets', 'square', 'flat', 'dry', 'compact'],
  ['cramped', 'crumbling', 'tomb', 'single-level', 'no-backdoor'],
  ['spacious', 'dwelling', 'treasure', 'dangerous'],
];
const SIZES = ['small', 'medium', 'large', ''] as const;
const RANGES: Record<(typeof SIZES)[number], [number, number]> = { small: [3, 6], medium: [6, 12], large: [12, 25], '': [6, 15] };

interface Run {
  seed: number;
  tags: string[];
  model: DungeonModel;
  ms: number;
}

function runs(): Run[] {
  const out: Run[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const combo = COMBOS[seed % COMBOS.length] ?? [];
    for (const size of SIZES) {
      const tags = size ? [...combo, size] : [...combo];
      const start = performance.now();
      const model = generateDungeon({ seed: seed * 7919, tags });
      out.push({ seed: seed * 7919, tags, model, ms: performance.now() - start });
    }
  }
  return out;
}

const ALL = runs();

function failures(check: (run: Run) => string[]): string[] {
  return ALL.flatMap((run) => check(run).map((problem) => `seed ${run.seed} [${run.tags.join(',')}]: ${problem}`)).slice(0, 10);
}

function has(run: Run, tag: string): boolean {
  return run.model.tags.includes(tag);
}

describe('generated dungeons', () => {
  it('never overlap floors, and every floor stays clear of other rooms’ walls', () => {
    expect(failures((run) => floorProblems(run.model))).toEqual([]);
  });

  it('keep every rotunda and its wall clear of other rooms and their walls, but at a door', () => {
    expect(ALL.some((run) => run.model.rooms.some((room) => room.rotunda))).toBe(true);
    expect(failures((run) => rotundaProblems(run.model))).toEqual([]);
    // The check itself sees a room laid against a rotunda's wall.
    const run = ALL.find((r) => r.model.rooms.some((room) => room.rotunda))!;
    const rotunda = run.model.rooms.find((room) => room.rotunda)!;
    const against = { ...rotunda, id: run.model.rooms.length, rotunda: false, x: rotunda.x + rotunda.w + 0.2, y: rotunda.y + 1, w: 2, h: 1 };
    expect(rotundaProblems({ ...run.model, rooms: [...run.model.rooms, against] })).not.toEqual([]);
  });

  it('put every door in the wall between its two rooms, or in an outer wall', () => {
    expect(failures((run) => doorProblems(run.model))).toEqual([]);
  });

  it('can be walked from the entrance to every room', () => {
    expect(failures((run) => unreachableRooms(run.model).map((id) => `room ${id} unreachable`))).toEqual([]);
  });

  it('have as many normal rooms as their size asks for', () => {
    expect(
      failures((run) => {
        const size = SIZES.find((s) => s && run.tags.includes(s)) ?? '';
        const [min, max] = RANGES[size];
        const count = run.model.rooms.filter((room) => room.kind === 'room').length;
        return count < min || count > max ? [`${count} normal rooms, not ${min}–${max}`] : [];
      }),
    ).toEqual([]);
  });

  it('grow a string without branches', () => {
    expect(
      failures((run) => {
        if (!has(run, 'string')) return [];
        return run.model.rooms.filter((room) => run.model.rooms.filter((r) => r.parent === room.id).length > 1).map((room) => `room ${room.id} branches`);
      }),
    ).toEqual([]);
  });

  it('lock a separate culmination wing behind one gate', () => {
    expect(
      failures((run) => {
        const gates = run.model.doors.filter((door) => door.kind === 'gate').length;
        const separate = run.model.rooms.some((room) => room.wing === 'culmination' || room.wing === 'approach');
        const problems: string[] = [];
        if (gates !== (separate ? 1 : 0)) problems.push(`${gates} gates, separate wing ${separate}`);
        if (run.model.rooms.filter((room) => room.ending).length !== 1) problems.push('not one culmination');
        return problems;
      }),
    ).toEqual([]);
  });

  it('never open a way past the gate or into a secret wing', () => {
    expect(failures((run) => bypasses(run.model))).toEqual([]);
  });

  it('keep dry dungeons dry, flat ones flat, square ones square and secretless ones open', () => {
    expect(
      failures((run) => {
        const problems: string[] = [];
        if (has(run, 'dry') && (run.model.water.length > 0 || run.model.waterCells.length > 0)) problems.push('water');
        if (has(run, 'flat') && run.model.doors.some((door) => door.kind === 'steps')) problems.push('steps');
        if (has(run, 'square') && run.model.rooms.some((room) => room.rotunda)) problems.push('rotunda');
        if (has(run, 'no-secrets') && run.model.doors.some((door) => door.kind === 'secret')) problems.push('secret door');
        if (has(run, 'single-level') && run.model.doors.some((door) => door.kind === 'stairs-down')) problems.push('stairs down');
        return problems;
      }),
    ).toEqual([]);
  });

  it('add tags by chance only where no tag rules them out', () => {
    expect(
      failures((run) => {
        const problems: string[] = [];
        if (has(run, 'multi-level') && has(run, 'single-level')) problems.push('multi-level and single-level');
        if (has(run, 'string') && (has(run, 'winding') || has(run, 'secret'))) problems.push('string with winding or secret');
        if (has(run, 'deep') && has(run, 'flat')) problems.push('deep and flat');
        if (!run.tags.every((tag) => has(run, tag))) problems.push('a tag the GM asked for is gone');
        return problems;
      }),
    ).toEqual([]);
    const untagged = ALL.filter((run) => !run.tags.includes('single-level'));
    const multi = untagged.filter((run) => has(run, 'multi-level')).length / untagged.length;
    expect(multi).toBeGreaterThan(0.4);
    expect(multi).toBeLessThan(0.75);
  });

  it('furnish rooms after what the plan put in them and the tags', () => {
    const share = (tag: string, kinds: readonly string[]): number => {
      const tagged = ALL.filter((run) => has(run, tag));
      return tagged.filter((run) => run.model.props.some((p) => kinds.includes(p.kind) && !run.model.rooms[p.room]?.ending)).length / tagged.length;
    };
    expect(share('temple', ['altar'])).toBeGreaterThan(0.4);
    expect(share('tomb', ['sarcophagus'])).toBeGreaterThan(0.4);
    expect(share('dwelling', ['throne', 'tapestry'])).toBeGreaterThan(0.6);
    expect(share('treasure', ['chest'])).toBeGreaterThan(0.6);
    const props = ALL.reduce((sum, run) => sum + run.model.props.length, 0) / ALL.length;
    expect(props).toBeGreaterThan(5);
  });

  it('make round rooms only of square floors', () => {
    expect(failures((run) => run.model.rooms.filter((r) => r.rotunda && (r.w !== r.h || r.kind !== 'room')).map((r) => `room ${r.id}`))).toEqual([]);
  });

  it('let the tags show', () => {
    const share = (tag: string, check: (model: DungeonModel) => boolean): number => {
      const tagged = ALL.filter((run) => has(run, tag));
      return tagged.filter((run) => check(run.model)).length / tagged.length;
    };
    expect(share('multi-level', (m) => m.doors.some((d) => d.kind === 'stairs-down'))).toBeGreaterThan(0.9);
    expect(share('backdoor', (m) => m.doors.filter((d) => d.kind === 'entrance').length > 1)).toBeGreaterThan(0.9);
    expect(share('secret', (m) => m.doors.some((d) => d.kind === 'secret'))).toBeGreaterThan(0.7);
    expect(share('round', (m) => m.rooms.some((r) => r.rotunda))).toBeGreaterThan(0.5);
    expect(share('flooded', (m) => m.waterCells.length > 0)).toBeGreaterThan(0.9);
    expect(share('deep', (m) => m.doors.some((d) => d.kind === 'steps'))).toBeGreaterThan(0.5);
  });

  it('generate a large dungeon within 50 ms', () => {
    const large = ALL.filter((run) => run.tags.includes('large'))
      .map((run) => run.ms)
      .sort((a, b) => a - b);
    expect(large[Math.floor(large.length * 0.95)]).toBeLessThan(50);
  });
});
