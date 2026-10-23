import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import type { DungeonModel } from '../../../src/app/dungeons/model';
import { doorProblems, emptyRooms, floorProblems, independentLoops, loopProblems, normals, rotundaProblems, secretProblems, unreachableRooms } from './dungeonInvariants';
import { connectionProblems, entranceProblems, stairProblems } from './floorsInvariants';

/**
 * Every rule of the generator, held over many dungeons of one floor count: 1,000 seeds, each with
 * three of the tag sets below, so each floor count meets every set over a few hundred seeds.
 */

const SEEDS = 1000;
const TAG_SETS: readonly string[][] = [
  [],
  ['small'],
  ['large'],
  ['medium', 'ordered', 'temple', 'colonnades'],
  ['chaotic', 'winding', 'wet', 'tomb'],
  ['string', 'deep', 'flooded'],
  ['secret', 'round', 'dwelling'],
  ['no-secrets', 'square', 'flat', 'dry', 'compact'],
  ['cramped', 'crumbling', 'large'],
];
const RANGES: Record<string, [number, number]> = { small: [3, 6], medium: [6, 12], large: [12, 25], '': [6, 15] };

export interface Run {
  seed: number;
  tags: string[];
  model: DungeonModel;
  ms: number;
}

function runsOf(floors: number): Run[] {
  const out: Run[] = [];
  for (let k = 1; k <= SEEDS; k++) {
    const seed = k * 7919 + floors;
    for (const offset of [0, 3, 6]) {
      const tags = TAG_SETS[(k + offset) % TAG_SETS.length] ?? [];
      const start = performance.now();
      const model = generateDungeon({ seed, tags, floors });
      out.push({ seed, tags, model, ms: performance.now() - start });
    }
  }
  return out;
}

export function describeInvariants(floors: number): void {
  const runs = runsOf(floors);
  const failures = (check: (run: Run) => string[]): string[] =>
    runs.flatMap((run) => check(run).map((problem) => `seed ${run.seed} [${run.tags.join(',')}]: ${problem}`)).slice(0, 10);
  const eachFloor = (check: (run: Run, index: number) => string[]) => (run: Run): string[] =>
    run.model.floors.flatMap((_, index) => check(run, index).map((problem) => `floor ${index}: ${problem}`));
  const has = (run: Run, tag: string): boolean => run.model.tags.includes(tag);

  describe(`generated dungeons of ${floors} floor${floors > 1 ? 's' : ''}`, () => {
    it('have as many floors as asked for, the deeper the fewer rooms, never fewer than three', () => {
      expect(failures((run) => (run.model.floors.length === floors ? [] : [`${run.model.floors.length} floors`]))).toEqual([]);
      expect(failures(eachFloor((run, i) => (normals(run.model.floors[i]!).length >= 3 ? [] : ['fewer than three rooms'])))).toEqual([]);
      const mean = (i: number): number => runs.reduce((sum, run) => sum + normals(run.model.floors[i]!).length, 0) / runs.length;
      for (let i = 1; i < floors; i++) expect(mean(i)).toBeLessThan(mean(i - 1));
    });

    it('never overlap floors within a floor, and every floor stays clear of other rooms’ walls', () => {
      expect(failures(eachFloor((run, i) => [...floorProblems(run.model.floors[i]!), ...rotundaProblems(run.model.floors[i]!)]))).toEqual([]);
    });

    it('put every door in the wall between its two rooms, or an entrance in an outer wall of the entry floor', () => {
      expect(failures(eachFloor((run, i) => doorProblems(run.model.floors[i]!, i === 0)))).toEqual([]);
    });

    it('can be walked from where each floor is entered to every room', () => {
      expect(failures(eachFloor((run, i) => unreachableRooms(run.model.floors[i]!).map((id) => `room ${id} unreachable`)))).toEqual([]);
    });

    it('run a loop through the way to the farthest room, about one loop per eight rooms', () => {
      expect(failures(eachFloor((run, i) => loopProblems(run.model.floors[i]!)))).toEqual([]);
      const floorsOf = runs.flatMap((run) => run.model.floors);
      const loops = floorsOf.reduce((sum, floor) => sum + independentLoops(floor), 0);
      const wanted = floorsOf.reduce((sum, floor) => sum + normals(floor).length / 8, 0);
      expect(loops / wanted).toBeGreaterThan(0.7);
      expect(loops / wanted).toBeLessThan(1.6);
    });

    it('open the entry floor at (0, 0), and from six rooms by a second, less obvious way', () => {
      expect(failures((run) => entranceProblems(run.model))).toEqual([]);
    });

    it('hide nothing a party needs behind a secret door', () => {
      expect(failures(eachFloor((run, i) => secretProblems(run.model.floors[i]!)))).toEqual([]);
    });

    it('leave about a third of the rooms empty', () => {
      const counts = runs.flatMap((run) => run.model.floors.map(emptyRooms));
      const share = counts.reduce((sum, c) => sum + c.empty, 0) / counts.reduce((sum, c) => sum + c.rooms, 0);
      expect(share).toBeGreaterThanOrEqual(0.25);
      expect(share).toBeLessThanOrEqual(0.42);
    });

    it('join floors by stairwells that line up, in rooms that stay passable', () => {
      expect(failures((run) => stairProblems(run.model))).toEqual([]);
      if (floors === 1) expect(runs.every((run) => run.model.floors[0]!.stairs.length === 0)).toBe(true);
    });

    it('join floors by two stairwells far apart where both have six rooms or more', () => {
      expect(failures((run) => connectionProblems(run.model))).toEqual([]);
    });

    it('have the entry floor as large as its size tag asks', () => {
      expect(
        failures((run) => {
          const size = ['small', 'medium', 'large'].find((s) => run.tags.includes(s)) ?? '';
          const [min, max] = RANGES[size]!;
          const count = normals(run.model.floors[0]!).length;
          return count < min || count > max ? [`${count} normal rooms, not ${min}–${max}`] : [];
        }),
      ).toEqual([]);
    });

    it('keep to their tags: strings unbranched, dry dry, flat flat, square square, secretless open', () => {
      expect(
        failures(eachFloor((run, i) => {
          const floor = run.model.floors[i]!;
          const problems: string[] = [];
          if (has(run, 'string') && floor.rooms.some((room) => floor.rooms.filter((r) => r.parent === room.id).length > 1)) problems.push('a string branches');
          if (has(run, 'dry') && floor.waterCells.length > 0) problems.push('water');
          if (has(run, 'flat') && floor.doors.some((door) => door.kind === 'steps')) problems.push('steps');
          if (has(run, 'square') && floor.rooms.some((room) => room.rotunda)) problems.push('rotunda');
          if (has(run, 'no-secrets') && floor.doors.some((door) => door.kind === 'secret')) problems.push('secret door');
          if (floor.rooms.some((r) => r.rotunda && (r.w !== r.h || r.kind !== 'room'))) problems.push('a round room that is not square');
          return problems;
        })),
      ).toEqual([]);
    });

    it('let the tags show', () => {
      const share = (tag: string, check: (model: DungeonModel) => boolean): number => {
        const tagged = runs.filter((run) => has(run, tag));
        return tagged.filter((run) => check(run.model)).length / tagged.length;
      };
      const anyFloor = (model: DungeonModel, check: (floor: DungeonModel['floors'][number]) => boolean): boolean => model.floors.some(check);
      expect(share('secret', (m) => anyFloor(m, (f) => f.doors.some((d) => d.kind === 'secret')))).toBeGreaterThan(0.7);
      expect(share('round', (m) => anyFloor(m, (f) => f.rooms.some((r) => r.rotunda)))).toBeGreaterThan(0.5);
      expect(share('flooded', (m) => anyFloor(m, (f) => f.waterCells.length > 0))).toBeGreaterThan(0.9);
      expect(share('deep', (m) => anyFloor(m, (f) => f.doors.some((d) => d.kind === 'steps')))).toBeGreaterThan(0.5);
      expect(share('temple', (m) => anyFloor(m, (f) => f.props.some((p) => p.kind === 'altar')))).toBeGreaterThan(0.5);
      expect(share('tomb', (m) => anyFloor(m, (f) => f.props.some((p) => p.kind === 'sarcophagus')))).toBeGreaterThan(0.5);
      expect(share('dwelling', (m) => anyFloor(m, (f) => f.props.some((p) => p.kind === 'throne' || p.kind === 'tapestry' || p.kind === 'well')))).toBeGreaterThan(0.6);
    });

    it('furnish the largest hall with a centrepiece or a dais, and set every dais against a wall', () => {
      const halls = runs.flatMap((run) => run.model.floors.map((floor) => ({ floor, hall: [...normals(floor)].sort((a, b) => b.w * b.h - a.w * a.h)[0] }))).filter(({ hall }) => hall && hall.w * hall.h >= 12);
      const centred = halls.filter(({ floor, hall }) => floor.props.some((p) => p.room === hall!.id && ['dais', 'fountain', 'statue', 'well'].includes(p.kind)));
      expect(centred.length / halls.length).toBeGreaterThan(0.6);
      expect(
        failures(eachFloor((run, i) => {
          const floor = run.model.floors[i]!;
          return floor.props.filter((p) => p.kind === 'dais').flatMap((p) => {
            const room = floor.rooms[p.room]!;
            const onWall = [room.x, room.x + room.w].some((x) => Math.abs(p.x - x) < 1e-6) || [room.y, room.y + room.h].some((y) => Math.abs(p.y - y) < 1e-6);
            return onWall && !room.rotunda ? [] : [`a dais free in room ${room.id}`];
          });
        })),
      ).toEqual([]);
    });

    it('generate within the time budget', () => {
      const times = runs.map((run) => run.ms).sort((a, b) => a - b);
      expect(times[Math.floor(times.length * 0.95)]).toBeLessThan(25 * floors);
    });
  });
}
