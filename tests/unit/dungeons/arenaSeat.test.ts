import { describe, expect, it } from 'vitest';
import { cellKey } from '../../../src/app/dungeons/geometry';
import { platformAtFarWall } from '../../../src/app/dungeons/terrain/elevation';
import { seatOnPlatform } from '../../../src/app/dungeons/terrain/typeArena';
import type { ArenaSpec } from '../../../src/app/dungeons/themes/themeTypes';
import { furnished } from './furnishFixtures';

const arena = (seat: ArenaSpec['seat']): ArenaSpec => ({ seat, setPieces: [], mirrored: [], hazards: [] });

describe('the seat on an arena platform', () => {
  it('seats a cell-piece seat on the platform', () => {
    const fs = furnished(7, 8);
    const id = platformAtFarWall(fs.floor, fs.cells, 2, 5, 1);
    const platform = fs.floor.pieces[id!]!;
    const bedroll = seatOnPlatform(fs, platform, arena('bedroll'));
    expect(bedroll?.kind).toBe('bedroll');
    const on = new Set(platform.cells.map((c) => cellKey(c.x, c.y)));
    const placed = fs.placed.at(-1)!;
    expect(placed.cells).toHaveLength(2);
    for (const c of placed.cells) expect(on.has(cellKey(c.x, c.y))).toBe(true);
  });

  it('seats a disc on the middle of the platform, facing down its steps', () => {
    const fs = furnished(7, 8);
    const platform = fs.floor.pieces[platformAtFarWall(fs.floor, fs.cells, 1, 5, 1)!]!;
    const throne = seatOnPlatform(fs, platform, arena('throne'));
    expect(throne?.kind).toBe('throne');
    expect(seatOnPlatform(furnished(7, 8), platform, arena(null))).toBeNull();
  });

  it('seats nothing it is not offered', () => {
    const fs = furnished(7, 8, { offered: new Set() });
    const platform = fs.floor.pieces[platformAtFarWall(fs.floor, fs.cells, 1, 5, 1)!]!;
    expect(seatOnPlatform(fs, platform, arena('throne'))).toBeNull();
  });
});
