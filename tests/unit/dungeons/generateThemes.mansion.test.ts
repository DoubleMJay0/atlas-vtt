import { describe, expect, it } from 'vitest';
import type { DungeonModel } from '../../../src/app/dungeons/model';
import { MANSION } from '../../../src/app/dungeons/themes/mansion';
import { normals } from './dungeonInvariants';
import { apartProblems, branchOf, entranceRoom, floorDepth, nextRooms, type Place, roomsOfType, typeOf, typingProblems } from './themeInvariants';
import { failuresOf, shareOf, themeRuns } from './themeRuns';
import { describeThemeTerrain } from './themeTerrainRules';

/** The rules of a Haunted Mansion (report §3.2 Manor), each held over 500 dungeons of one to three floors. */
describe('generated Haunted Mansions', () => {
  const runs = themeRuns('mansion');
  const reception = (m: DungeonModel): Place[] => [...roomsOfType(m, 'drawing-room'), ...roomsOfType(m, 'dining-room')];
  const area = (m: DungeonModel, p: Place): number => {
    const room = m.floors[p.floor]!.rooms[p.room]!;
    return room.w * room.h;
  };

  it('opens on the entrance hall', () => {
    expect(failuresOf(runs, (m) => (typeOf(m, entranceRoom(m)) === 'entrance-hall' ? [] : [`entered by a ${typeOf(m, entranceRoom(m))}`]))).toEqual([]);
  });

  it('keeps the reception rooms in the front two thirds of the entrance floor', () => {
    const rooms = runs.flatMap((run) => reception(run.model).map((p) => ({ m: run.model, p })));
    expect(rooms.filter(({ m, p }) => p.floor === 0 && floorDepth(m.floors[0]!, p.room) < 2 / 3).length / rooms.length).toBeGreaterThan(0.85);
  });

  it('puts the service wing on its own branch of the entrance floor', () => {
    const own = (m: DungeonModel): boolean => {
      const hall = entranceRoom(m);
      const kitchen = roomsOfType(m, 'kitchen')[0]!;
      const wing = branchOf(m, hall, kitchen);
      return wing !== null && kitchen.floor === 0 && reception(m).every((p) => branchOf(m, hall, p) !== wing);
    };
    expect(shareOf(runs, (m) => roomsOfType(m, 'kitchen').length > 0, own)).toBeGreaterThan(0.85);
  });

  it('sets every servery between kitchen and dining room', () => {
    expect(failuresOf(runs, (m) => roomsOfType(m, 'servery').flatMap((s) => {
      const floor = m.floors[s.floor]!;
      const next = nextRooms(floor, s.room).map((r) => floor.rooms[r]?.type);
      return next.includes('kitchen') && next.includes('dining-room') ? [] : [`servery ${s.room} beside ${next.join(', ')}`];
    }))).toEqual([]);
  });

  it("keeps wine cellar and laundry on the entrance floor and servants' rooms on the last", () => {
    expect(failuresOf(runs, (m) => [
      ...['wine-cellar', 'laundry'].flatMap((type) => roomsOfType(m, type).filter((p) => p.floor !== 0).map((p) => `${type} on floor ${p.floor}`)),
      ...roomsOfType(m, 'attic-room').filter((p) => p.floor !== m.floors.length - 1).map((p) => `attic room on floor ${p.floor}`),
    ])).toEqual([]);
  });

  it('keeps bedrooms off the entrance floor where there are more', () => {
    expect(failuresOf(runs, (m) => (m.floors.length > 1 ? roomsOfType(m, 'bedroom').filter((p) => p.floor === 0).map(() => 'a bedroom on the entrance floor') : []))).toEqual([]);
  });

  it('makes the bathroom the smallest room of its floor', () => {
    const baths = runs.flatMap((run) => roomsOfType(run.model, 'bathroom').map((p) => ({ m: run.model, p })));
    const smallest = baths.filter(({ m, p }) => normals(m.floors[p.floor]!).every((room) => room.w * room.h >= area(m, p)));
    expect(baths.length).toBeGreaterThan(0);
    expect(smallest.length / baths.length).toBeGreaterThan(0.8);
  });

  it('makes the ballroom the largest of its floor and never an upstairs dead end', () => {
    expect(failuresOf(runs, (m) => roomsOfType(m, 'ballroom').flatMap((p) => {
      const largest = normals(m.floors[p.floor]!).every((room) => room.w * room.h <= area(m, p));
      return largest && p.floor === 0 ? [] : [`ballroom ${p.room} on floor ${p.floor}`];
    }))).toEqual([]);
  });

  it('never sets the kitchen beside the drawing room or the master bedroom', () => {
    const pairs = [['kitchen', 'drawing-room'], ['kitchen', 'master-bedroom'], ['drawing-room', 'kitchen'], ['master-bedroom', 'kitchen']] as const;
    expect(failuresOf(runs, (m) => apartProblems(m, pairs))).toEqual([]);
  });

  it('holds no throne', () => {
    expect(failuresOf(runs, (m) => m.floors.flatMap((f) => f.props.filter((p) => p.kind === 'throne').map(() => 'a throne')))).toEqual([]);
  });

  it('uses only the types of its own theme and types every normal room', () => {
    const ids = new Set<string>(MANSION.rooms.map((spec) => spec.id));
    expect(failuresOf(runs, (m) => typingProblems(m, ids))).toEqual([]);
  });

  describeThemeTerrain(runs, MANSION);
});
