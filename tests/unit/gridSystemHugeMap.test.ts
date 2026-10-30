// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import { GridSystem } from '../../src/app/grid/GridSystem';
import { stubJsdomGraphics } from '../mocks/jsdomGraphics';
import { fakeMapImageView, settleGridColor } from '../helpers/fakeMapImageView';

let restoreGraphics: (() => void) | undefined;

afterEach(() => {
  restoreGraphics?.();
  restoreGraphics = undefined;
  vi.restoreAllMocks();
});

/** A viewport that says what it shows, in world units, and a ticker whose frames a test runs by hand. */
function stage(view: { x: number; y: number; width: number; height: number }): { viewport: Container; app: never; frame: () => void; look: (next: typeof view, zoom?: number) => void } {
  const viewport = Object.assign(new Container(), { getVisibleBounds: () => ({ ...view }) });
  const frames: Array<() => void> = [];
  const app = { renderer: { resolution: 1 }, ticker: { add: (fn: () => void) => frames.push(fn), remove: (fn: () => void) => frames.splice(frames.indexOf(fn), 1) } } as never;
  return {
    viewport,
    app,
    frame: () => { for (const fn of [...frames]) fn(); },
    look: (next, zoom) => { view = next; if (zoom !== undefined) viewport.scale.set(zoom); },
  };
}

const SIDE = 31622;

it('draws a dotted grid of a gigapixel map for the view alone, and again once the view leaves that part', async () => {
  restoreGraphics = stubJsdomGraphics();
  const { viewport, app, frame, look } = stage({ x: 10000, y: 12000, width: 1500, height: 900 });
  const map = fakeMapImageView(SIDE, SIDE);
  viewport.addChild(map.layer);
  const grid = new GridSystem(app, viewport as never, map, { type: 'square', size: 70, lineType: 'dotted' });
  try {
    await settleGridColor();
    // The view with a view's margin on every side: 4,500 × 2,700 of the 31,622 px map, not all of it.
    expect(grid.drawing).toEqual({ lineType: 'dotted', bounds: { minX: 8500, minY: 11100, maxX: 13000, maxY: 13800 } });
    const before = grid.getGridSprite();
    look({ x: 10200, y: 12100, width: 1500, height: 900 });
    frame();
    expect(grid.getGridSprite()).toBe(before);
    look({ x: 20000, y: 12000, width: 1500, height: 900 });
    frame();
    await settleGridColor();
    expect(grid.getGridSprite()).not.toBe(before);
    expect(grid.drawing!.bounds).toEqual({ minX: 18500, minY: 11100, maxX: 23000, maxY: 13800 });
  } finally { grid.destroy(); }
});

it('draws the dots as solid lines where the view holds too many of them, and leaves the numbers off a map of too many cells', async () => {
  restoreGraphics = stubJsdomGraphics();
  // The whole gigapixel map in view: 31,622 / 8 cells across, far past the marks a region may hold.
  const { viewport, app } = stage({ x: 0, y: 0, width: SIDE, height: SIDE });
  const map = fakeMapImageView(SIDE, SIDE);
  viewport.addChild(map.layer);
  const grid = new GridSystem(app, viewport as never, map, { type: 'square', size: 8, lineType: 'dotted', cellNumbers: { format: 'column-row', opacity: 0.8 } });
  try {
    await settleGridColor();
    expect(grid.drawing).toEqual({ lineType: 'solid', bounds: { minX: -8, minY: -8, maxX: SIDE + 8, maxY: SIDE + 8 } });
    expect(grid.getGridSprite()!.children.find((child) => child.label === 'cell-numbers')).toBeUndefined();
  } finally { grid.destroy(); }
});

it('draws a solid grid whole, whatever the view', async () => {
  restoreGraphics = stubJsdomGraphics();
  const { viewport, app } = stage({ x: 10000, y: 12000, width: 1500, height: 900 });
  const map = fakeMapImageView(SIDE, SIDE);
  viewport.addChild(map.layer);
  const grid = new GridSystem(app, viewport as never, map, { type: 'square', size: 70, lineType: 'solid' });
  try {
    await settleGridColor();
    expect(grid.drawing).toEqual({ lineType: 'solid', bounds: { minX: -70, minY: -70, maxX: SIDE + 70, maxY: SIDE + 70 } });
  } finally { grid.destroy(); }
});
