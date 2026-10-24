import { expect, it } from 'vitest';
import type { DungeonModel } from '../../../src/app/dungeons/model';
import { PROP_SPECS } from '../../../src/app/dungeons/props/catalogue';
import type { RoomProgramme } from '../../../src/app/dungeons/themes/themeTypes';
import { normals } from './dungeonInvariants';
import { hasCover, isHazard } from './terrainInvariants';
import { type ThemeRun, failuresOf } from './themeRuns';
import { hazardFurnitureProblems, mirrorProblems, physicsProblems, reasonProblems, shapeProblems } from './themeTerrainInvariants';

/** The terrain rules every built theme keeps, held over its runs: each as its own case. */
export function describeThemeTerrain(runs: readonly ThemeRun[], programme: RoomProgramme): void {
  const columns = new Set<string>(programme.rooms.filter((spec) => spec.terrain.columns).map((spec) => spec.id));

  it('holds no hazard in a furnished room and no formal furniture in a hazard room', () => {
    expect(failuresOf(runs, hazardFurnitureProblems)).toEqual([]);
  });

  it('gives every furnished room that can hold a fight some cover', () => {
    // Furniture on the floor furnishes a room for a fight; pictures on its walls do not.
    const standing = (floor: DungeonModel['floors'][number], room: number): boolean => floor.props.some((p) => p.room === room && !PROP_SPECS[p.kind].wallPiece);
    expect(failuresOf(runs, (m) => m.floors.flatMap((floor, f) => normals(floor)
      .filter((room) => room.w * room.h >= 12 && !room.boss && standing(floor, room.id) && !hasCover(floor, room.id))
      .map((room) => `floor ${f}: ${room.type} ${room.id} (${room.w}×${room.h}) has no cover`)))).toEqual([]);
  });

  it('places hazards within the theme\'s band', () => {
    const plain = runs.filter((run) => !run.model.tags.includes('ruined'));
    const hazards = plain.reduce((sum, run) => sum + run.model.floors.reduce((s, f) => s + f.terrain.filter((p) => isHazard(p) && f.rooms[p.room]?.type && !f.rooms[p.room]?.boss).length, 0), 0);
    const rooms = plain.reduce((sum, run) => sum + run.model.floors.reduce((s, f) => s + normals(f).length, 0), 0);
    const band = programme.rooms.some((spec) => spec.terrain.hazards?.length && !spec.ruinedOnly) ? 0.08 : 0;
    expect(hazards / rooms).toBeLessThanOrEqual(band);
  });

  it('keeps columns to the types that take them', () => {
    expect(failuresOf(runs, (m) => m.floors.flatMap((floor) => floor.rooms.filter((room) => room.colonnade && room.type && !columns.has(room.type)).map((room) => `a colonnade in a ${room.type}`)))).toEqual([]);
  });

  it('keeps pews to chapels', () => {
    expect(failuresOf(runs, (m: DungeonModel) => m.floors.flatMap((floor) => floor.terrain.filter((p) => p.kind === 'pews' && floor.rooms[p.room]?.type !== 'chapel').map((p) => `pews in a ${floor.rooms[p.room]?.type}`)))).toEqual([]);
  });

  it('gives every feature and every pool a reason of its room type', () => {
    expect(failuresOf(runs, (m) => reasonProblems(m, programme))).toEqual([]);
  });

  it('keeps holes and molten channels clear of standing water', () => {
    expect(failuresOf(runs, physicsProblems)).toEqual([]);
  });

  it('shapes natural features irregularly, built openings along the walls, and mirrors no natural feature', () => {
    expect(failuresOf(runs, (m) => [...shapeProblems(m, programme), ...mirrorProblems(m)])).toEqual([]);
  });
}
