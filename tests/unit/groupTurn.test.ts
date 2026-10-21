import { describe, expect, it } from 'vitest';
import { snapTokenCenter } from '../../src/app/grid/gridPlacement';
import { createHexLayout, nearestHexCenter } from '../../src/app/grid/hexGeometry';
import {
  landTokens, orbit, pointerTurn, snapTurn, turnLabel, turnPoints, turnTokens, turnedFacing, type Point, type TokenAtStart,
} from '../../src/app/pixi/selection/groupTurn';

const CELL = 70;
/** The middle of the square cell holding the point, on a grid whose lines run through 0. */
const squareCell = (point: Point): Point => ({ x: (Math.floor(point.x / CELL) + 0.5) * CELL, y: (Math.floor(point.y / CELL) + 0.5) * CELL });
const landOnSquares = (point: Point, size: number): Point => snapTokenCenter(point, size, 'square', CELL, squareCell);

describe('pointerTurn', () => {
  const centre = { x: 100, y: 100 };

  it('reads a quarter turn clockwise on screen as +90°, as a token turns', () => {
    expect(pointerTurn(centre, { x: 100, y: 0 }, { x: 200, y: 100 })).toBeCloseTo(90);
    expect(pointerTurn(centre, { x: 100, y: 0 }, { x: 0, y: 100 })).toBeCloseTo(-90);
  });

  it('stays within a half turn either way across the seam behind the centre', () => {
    expect(pointerTurn(centre, { x: 0, y: 99 }, { x: 0, y: 101 })).toBeCloseTo(-1.15, 1);
    expect(pointerTurn(centre, { x: 0, y: 101 }, { x: 0, y: 99 })).toBeCloseTo(1.15, 1);
  });
});

describe('snapTurn', () => {
  it('snaps to 15°, or 45° with Shift, as a single token turns', () => {
    expect(snapTurn(37, false)).toBe(30);
    expect(snapTurn(38, false)).toBe(45);
    expect(snapTurn(37, true)).toBe(45);
    expect(snapTurn(-67, true)).toBe(-45);
  });

  it('gives no negative zero and turns a half turn one way', () => {
    expect(Object.is(snapTurn(-3, false), 0)).toBe(true);
    expect(snapTurn(-179, false)).toBe(180);
  });
});

describe('turning a group', () => {
  const centre = { x: 0, y: 0 };

  it('orbits a place about the centre, landing on whole pixels after a quarter turn', () => {
    expect(orbit({ x: 70, y: 0 }, centre, 90)).toEqual({ x: 0, y: 70 });
    expect(orbit({ x: 70, y: 0 }, { x: 35, y: 35 }, 180)).toEqual({ x: 0, y: 70 });
  });

  it('turns every facing by the same angle, kept within one turn', () => {
    expect(turnedFacing(undefined, 45)).toBe(45);
    expect(turnedFacing(330, 45)).toBe(15);
    expect(turnedFacing(10, -30)).toBe(340);
  });

  it('moves each token round the centre and faces it as much further round', () => {
    const tokens: TokenAtStart[] = [
      { id: 'a', x: -70, y: 0, rotation: 0, size: 1 },
      { id: 'b', x: 70, y: 0, rotation: 90, size: 1 },
    ];
    expect(turnTokens(tokens, centre, 90)).toEqual([
      { id: 'a', x: 0, y: -70, rotation: 90 },
      { id: 'b', x: 0, y: 70, rotation: 180 },
    ]);
  });

  it('turns the points of a drawing with the group', () => {
    expect(turnPoints([{ x: 10, y: 0 }, { x: 0, y: 10 }], centre, -90)).toEqual([{ x: 0, y: -10 }, { x: 10, y: 0 }]);
  });

  it('puts the tokens down where a dropped token snaps: cell middles, and grid corners for an even footprint', () => {
    const tokens: TokenAtStart[] = [
      { id: 'small', x: 35, y: 35, rotation: undefined, size: 1 },
      { id: 'large', x: 210, y: 70, rotation: 0, size: 1.5 },
    ];
    const landed = landTokens(tokens, { x: 105, y: 70 }, 30, landOnSquares);
    expect(landed.map(({ x, y }) => [x % CELL, y % CELL])).toEqual([[35, 35], [0, 0]]);
    expect(landed.map(({ rotation }) => rotation)).toEqual([30, 30]);
  });

  it('puts the tokens down on hex centres on a hex grid', () => {
    const layout = createHexLayout('hex-vertical', CELL, 0, 0);
    const tokens: TokenAtStart[] = [{ id: 'a', x: 300, y: 200, rotation: 0, size: 1 }];
    const [landed] = landTokens(tokens, { x: 100, y: 100 }, 45, (point) => nearestHexCenter(layout, point));
    const turned = orbit(tokens[0]!, { x: 100, y: 100 }, 45);
    expect(landed).toEqual({ id: 'a', ...nearestHexCenter(layout, turned), rotation: 45 });
  });

  it('turning back by the same angle puts every token where it was', () => {
    const tokens: TokenAtStart[] = [{ id: 'a', x: 123, y: -45, rotation: 15, size: 1 }];
    const [there] = turnTokens(tokens, { x: 7, y: 9 }, 135);
    const [back] = turnTokens([{ ...there!, size: 1 }], { x: 7, y: 9 }, -135);
    expect(back!.x).toBeCloseTo(123, 9);
    expect(back!.y).toBeCloseTo(-45, 9);
    expect(back!.rotation).toBe(15);
  });

  it('labels the angle in whole degrees with a true minus sign', () => {
    expect(turnLabel(45)).toBe('45°');
    expect(turnLabel(-15)).toBe('−15°');
  });
});
