import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import { FIVE_ROOM_STAGES, type DungeonFloor, type DungeonModel, type FiveRoomStage } from '../../../src/app/dungeons/model';
import { distances, doorProblems, secretProblems, unreachableRooms } from './dungeonInvariants';
import { bridgeProblems, cellProblems, clearanceProblems, hasCover, holeProblems, routeProblems, stairClearanceProblems } from './terrainInvariants';

/**
 * Five-room dungeons (Johnn Four's structure) over 1,000 seeds: one floor whatever was asked, five
 * main rooms in their order along the way in, the climax the boss room, the reward beyond it, each
 * stage built as architecture, and every terrain rule kept.
 */

const SEEDS = 1000;
const TAG_SETS: readonly string[][] = [[], ['temple'], ['crumbling'], ['wet', 'tomb'], ['dry', 'dwelling'], ['large'], ['small'], ['round']];

const runs: { seed: number; tags: string[]; model: DungeonModel }[] = Array.from({ length: SEEDS }, (_, k) => {
  const seed = (k + 1) * 6271;
  const tags = TAG_SETS[k % TAG_SETS.length] ?? [];
  return { seed, tags, model: generateDungeon({ seed, tags, floors: 1 + (k % 4), fiveRoom: true, bossRoom: k % 3 === 0 ? false : undefined }) };
});

function failures(check: (floor: DungeonFloor, model: DungeonModel) => string[]): string[] {
  return runs.flatMap(({ seed, tags, model }) => check(model.floors[0]!, model).map((p) => `seed ${seed} [${tags.join(',')}]: ${p}`)).slice(0, 10);
}

function stageRoom(floor: DungeonFloor, stage: FiveRoomStage) {
  return floor.rooms.find((room) => room.stage === stage);
}

const share = (check: (floor: DungeonFloor) => boolean): number => runs.filter(({ model }) => check(model.floors[0]!)).length / runs.length;

describe('five-room dungeons', () => {
  it('have one floor and each of the five stages once, in order along the way in', () => {
    expect(failures((_, model) => (model.floors.length === 1 ? [] : [`${model.floors.length} floors`]))).toEqual([]);
    expect(
      failures((floor) => {
        const rooms = FIVE_ROOM_STAGES.map((stage) => floor.rooms.filter((room) => room.stage === stage));
        if (rooms.some((r) => r.length !== 1)) return [`stages ${rooms.map((r) => r.length).join('/')}`];
        const hops = distances(floor, 0);
        const order = rooms.map((r) => hops.get(r[0]!.id) ?? Infinity);
        return order.every((d, i) => i === 0 || d > order[i - 1]!) ? [] : [`stages at ${order.join(', ')} doors in`];
      }),
    ).toEqual([]);
    expect(failures((floor) => (floor.rooms.filter((room) => room.kind === 'room' && !room.stage).length === 0 ? [] : ['a normal room without a stage']))).toEqual([]);
  });

  it('make the climax the boss room, entered from the setback side alone, the reward beyond it', () => {
    expect(
      failures((floor) => {
        const climax = stageRoom(floor, 'climax');
        const reward = stageRoom(floor, 'reward');
        if (!climax?.boss || floor.rooms.filter((r) => r.boss).length !== 1) return ['the climax is no boss room'];
        const neighbours = (id: number): Set<number | null> => new Set(floor.doors.filter((d) => d.from === id || d.to === id).map((d) => (d.from === id ? d.to : d.from)));
        const rewardWays = neighbours(reward!.id);
        if (rewardWays.size !== 1 || !rewardWays.has(climax.id)) return ['the reward is not reached through the climax alone'];
        const climaxWays = [...neighbours(climax.id)].filter((id) => id !== reward!.id);
        return climaxWays.length === 1 ? [] : [`the climax is entered from ${climaxWays.join(', ')}`];
      }),
    ).toEqual([]);
  });

  it('build each stage as architecture, in more than one way, and without mechanisms', () => {
    const pieces = (floor: DungeonFloor, stage: FiveRoomStage) => floor.terrain.filter((p) => p.room === stageRoom(floor, stage)?.id);
    const way = (floor: DungeonFloor, stage: FiveRoomStage): string => [...new Set(pieces(floor, stage).map((p) => p.kind))].sort().join('+');
    expect(share((f) => pieces(f, 'entrance').some((p) => p.kind === 'low-wall'))).toBeGreaterThan(0.2);
    expect(share((f) => pieces(f, 'entrance').some((p) => p.kind === 'low-wall'))).toBeLessThan(0.8);
    expect(share((f) => pieces(f, 'puzzle').length > 0)).toBeGreaterThan(0.9);
    expect(share((f) => pieces(f, 'setback').some((p) => p.traits.hazard || p.traits.difficult || p.kind === 'ledge'))).toBeGreaterThan(0.85);
    expect(share((f) => pieces(f, 'setback').some((p) => p.traits.hazard))).toBeLessThan(0.8);
    expect(share((f) => pieces(f, 'climax').some((p) => p.kind === 'platform'))).toBeGreaterThan(0.6);
    expect(share((f) => pieces(f, 'reward').some((p) => p.traits.interactive))).toBeGreaterThan(0.6);
    expect(share((f) => stageRoom(f, 'reward')?.wing === 'secret')).toBeGreaterThan(0.4);
    // No stage is built the same way in most dungeons.
    for (const stage of ['entrance', 'puzzle', 'setback', 'reward'] as const) {
      const counts = new Map<string, number>();
      for (const { model } of runs) counts.set(way(model.floors[0]!, stage), (counts.get(way(model.floors[0]!, stage)) ?? 0) + 1);
      expect(Math.max(...counts.values()) / runs.length, stage).toBeLessThan(0.5);
    }
  });

  it('honour the tags that make sense for one string of rooms', () => {
    const secretShare = (tags: string[]): number => {
      let secret = 0;
      for (let seed = 1; seed <= 40; seed++) if (stageRoom(generateDungeon({ seed, tags, floors: 1, fiveRoom: true }).floors[0]!, 'reward')?.wing === 'secret') secret++;
      return secret / 40;
    };
    expect(secretShare(['secret'])).toBeGreaterThan(0.9);
    expect(secretShare(['no-secrets'])).toBe(0);
    const differs = (tag: string): number => {
      let changed = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const rooms = (tags: string[]) => JSON.stringify(generateDungeon({ seed, tags, floors: 1, fiveRoom: true }).floors[0]!.rooms.map((r) => [r.x, r.y, r.w, r.h, r.colonnade, r.rotunda]));
        if (rooms([]) !== rooms([tag])) changed++;
      }
      return changed;
    };
    for (const tag of ['compact', 'winding', 'small', 'ordered', 'chaotic', 'colonnades']) expect(differs(tag), tag).toBeGreaterThan(5);
  });

  it('keep every rule of the layout and the terrain', () => {
    expect(failures((floor) => [...doorProblems(floor, true), ...unreachableRooms(floor).map((id) => `room ${id} unreachable`), ...secretProblems(floor)])).toEqual([]);
    expect(failures((floor) => [...cellProblems(floor), ...clearanceProblems(floor, 0), ...routeProblems(floor), ...bridgeProblems(floor), ...stairClearanceProblems(floor, 0)])).toEqual([]);
    expect(failures((_, model) => holeProblems(model))).toEqual([]);
  });

  it('give the same dungeon for the same request', () => {
    for (const { seed, tags, model } of runs.slice(0, 200)) expect(generateDungeon({ seed, tags, floors: 1, fiveRoom: true })).toEqual(model);
  });
});
