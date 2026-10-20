import { describe, expect, it, vi } from 'vitest';
import { PlacementSession, type HeldToken } from '../../src/app/pixi/tokenPlacement/PlacementSession';
import { footprintCells, formationAt, queueSlot, type PlacementGrid, type Point } from '../../src/app/pixi/tokenPlacement/placementLayout';
import { Spring } from '../../src/app/pixi/tokenPlacement/placementSpring';
import type { PlacementGhost } from '../../src/app/pixi/tokenPlacement/PlacementGhost';
import type { PlacementMarks } from '../../src/app/pixi/tokenPlacement/PlacementMarks';
import type { TokenInput } from '../../src/app/types/viewState';

/** A square grid of 70 px cells from the origin. */
const square: PlacementGrid = {
  hex: false,
  cellSize: 70,
  snapToken: ({ x, y }, size) => {
    const shift = Math.round(2 * size - 1) % 2 === 0 ? 35 : 0;
    return { x: Math.floor((x - shift) / 70) * 70 + 35 + shift, y: Math.floor((y - shift) / 70) * 70 + 35 + shift };
  },
  cellCentre: ({ x, y }) => ({ x: Math.floor(x / 70) * 70 + 35, y: Math.floor(y / 70) * 70 + 35 }),
  cellOutline: (centre) => [centre],
};

describe('laying held tokens out', () => {
  it('moves the formation by whole cells, held by its middle', () => {
    const tokens = [{ home: { x: 35, y: 35 }, size: 1 }, { home: { x: 105, y: 35 }, size: 1 }, { home: { x: 35, y: 105 }, size: 1 }];
    expect(formationAt(tokens, { x: 290, y: 300 }, square)).toEqual([{ x: 245, y: 245 }, { x: 315, y: 245 }, { x: 245, y: 315 }]);
  });

  it('moves freely without a grid', () => {
    const tokens = [{ home: { x: 0, y: 0 }, size: 1 }, { home: { x: 100, y: 0 }, size: 1 }];
    expect(formationAt(tokens, { x: 13, y: 7 }, null)).toEqual([{ x: -37, y: 7 }, { x: 63, y: 7 }]);
  });

  it('lights the cells a footprint covers', () => {
    expect(footprintCells({ x: 35, y: 35 }, 1, square)).toEqual([{ x: 35, y: 35 }]);
    expect(footprintCells({ x: 70, y: 70 }, 1.5, square)).toHaveLength(4);
    expect(footprintCells({ x: 105, y: 105 }, 2, square)).toHaveLength(9);
    expect(footprintCells({ x: 140, y: 140 }, 2.5, square)).toHaveLength(16);
  });

  it('queues waiting tokens beside the pointer, smaller and fainter, the rest hidden behind the last', () => {
    const slots = [0, 1, 2, 3].map((index) => queueSlot(index, 35));
    expect(Math.hypot(slots[0]!.offset.x, slots[0]!.offset.y)).toBeGreaterThan(35 + slots[0]!.diameter / 2);
    expect(slots[1]!.offset.x).toBeGreaterThan(slots[0]!.offset.x);
    expect(slots[1]!.diameter).toBeLessThan(slots[0]!.diameter);
    expect(slots[2]!.alpha).toBeLessThan(slots[1]!.alpha);
    expect(slots[3]).toMatchObject({ offset: slots[2]!.offset, alpha: 0 });
  });
});

describe('a spring', () => {
  it('arrives at its target and rests there', () => {
    const spring = new Spring(0, { frequency: 30, damping: 1 });
    spring.target = 10;
    for (let i = 0; i < 60; i++) spring.step(1 / 60);
    expect(spring.atRest).toBe(true);
    expect(spring.value).toBe(10);
  });
});

/** A ghost that records how it was posed and whether it landed or vanished. */
function fakeGhost() {
  const ghost = { diameter: 70, poses: [] as Array<{ at: Point; part: string }>, landed: null as Point | null, vanished: false };
  return Object.assign(ghost, {
    pose: (pose: { at: Point }, part: string) => ghost.poses.push({ at: pose.at, part }),
    land: (at: Point) => { ghost.landed = at; },
    vanish: () => { ghost.vanished = true; },
  });
}

function hand(count: number) {
  const ghosts = Array.from({ length: count }, fakeGhost);
  const held: HeldToken[] = ghosts.map((ghost, i) => ({
    input: { imagePath: `t${i}.png`, x: 35 + 70 * i, y: 35 } as TokenInput,
    home: { x: 35 + 70 * i, y: 35 },
    size: 1,
    ghost: ghost as unknown as PlacementGhost,
  }));
  const committed: TokenInput[][] = [];
  const end = vi.fn();
  const marks = { light: vi.fn(), land: vi.fn(), clear: vi.fn() } as unknown as PlacementMarks;
  const session = new PlacementSession({
    toWorld: (p) => p,
    zoom: () => 1,
    grid: () => square,
    marks,
    count: () => undefined,
    commit: (tokens) => { committed.push(tokens); return tokens.map((token) => token.imagePath); },
    release: () => undefined,
    end,
  }, held, { x: 400, y: 300 });
  return { session, ghosts, committed, end, marks };
}

describe('placing held tokens', () => {
  it('puts the whole formation down with one click, on the grid', () => {
    const { session, committed, end, ghosts } = hand(3);
    session.put({ x: 300, y: 300 }, false);
    expect(committed).toEqual([[
      expect.objectContaining({ imagePath: 't0.png', x: 245, y: 315 }),
      expect.objectContaining({ imagePath: 't1.png', x: 315, y: 315 }),
      expect.objectContaining({ imagePath: 't2.png', x: 385, y: 315 }),
    ]]);
    expect(ghosts.every((ghost) => ghost.landed !== null)).toBe(true);
    expect(end).toHaveBeenCalledWith(['t0.png', 't1.png', 't2.png']);
  });

  it('puts one token down per click while Shift is held, and the rest as a formation once it is released', () => {
    const { session, committed, end, ghosts } = hand(4);
    session.moveTo({ x: 100, y: 100 }, true);
    expect(ghosts[0]!.poses.at(-1)).toEqual({ at: { x: 105, y: 105 }, part: 'head' });
    expect(ghosts[1]!.poses.at(-1)?.part).toBe('queue-0');
    session.put({ x: 100, y: 100 }, true);
    session.put({ x: 200, y: 100 }, true);
    expect(committed.map((batch) => batch.map(({ imagePath, x, y }) => [imagePath, x, y]))).toEqual([[['t0.png', 105, 105]], [['t1.png', 175, 105]]]);
    expect(ghosts[2]!.poses.at(-1)?.part).toBe('head');
    session.setShift(false);
    expect(ghosts[3]!.poses.at(-1)?.part).toBe('formation');
    session.put({ x: 400, y: 400 }, false);
    expect(committed[2]).toHaveLength(2);
    expect(end).toHaveBeenCalledWith(['t0.png', 't1.png', 't2.png', 't3.png']);
  });

  it('puts the tokens still held away and reports those already placed', () => {
    const { session, end, ghosts } = hand(3);
    session.put({ x: 100, y: 100 }, true);
    session.cancel();
    expect(ghosts.slice(1).every((ghost) => ghost.vanished)).toBe(true);
    expect(end).toHaveBeenCalledWith(['t0.png']);
    expect(session.active).toBe(false);
  });
});
