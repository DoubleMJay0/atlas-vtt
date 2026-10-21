// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Bounds, Text } from 'pixi.js';
import { LABEL_LOOK, MeasureLabel, labelCenter, pillSize, placeLabel, type Size } from '../../src/app/pixi/utils/measureLabel';

const PILL: Size = { width: 50, height: 26 };

/** How far apart a box of `size` around `center` and the point `p` lie. */
function gapToBox(center: { x: number; y: number }, size: Size, p: { x: number; y: number }): number {
  return Math.hypot(Math.max(Math.abs(p.x - center.x) - size.width / 2, 0), Math.max(Math.abs(p.y - center.y) - size.height / 2, 0));
}

describe('pillSize', () => {
  it('pads the text alike on every side, in whole pixels, with fully rounded ends', () => {
    expect(pillSize({ width: 30.2, height: 15.4 })).toEqual({ width: 43, height: 28, radius: 14 });
  });

  it('is never narrower than it is tall', () => {
    expect(pillSize({ width: 4, height: 15 })).toEqual({ width: 27, height: 27, radius: 13.5 });
  });
});

describe('placeLabel', () => {
  const clearance = LABEL_LOOK.dot + 1 + LABEL_LOOK.gap;

  it('stands above the middle of a level line, clear of it by the gap', () => {
    const at = placeLabel([{ x: 0, y: 0 }, { x: 200, y: 0 }], PILL)!;
    expect(at.x).toBeCloseTo(100);
    expect(at.y).toBeCloseTo(-(PILL.height / 2 + clearance));
  });

  it('stands to the right of an upright line, whichever way it was drawn', () => {
    for (const path of [[{ x: 0, y: 0 }, { x: 0, y: 200 }], [{ x: 0, y: 200 }, { x: 0, y: 0 }]]) {
      const at = placeLabel(path, PILL)!;
      expect(at.x).toBeCloseTo(PILL.width / 2 + clearance);
      expect(at.y).toBeCloseTo(100);
    }
  });

  it('keeps off a slanted line and its middle', () => {
    const path = [{ x: 0, y: 0 }, { x: 300, y: 200 }];
    const at = placeLabel(path, PILL)!;
    expect(gapToBox(at, PILL, { x: 150, y: 100 })).toBeGreaterThanOrEqual(clearance - 1e-9);
    expect(at.y).toBeLessThan(100);
  });

  it('steps away from the token a drag ruler leads to until it no longer covers it', () => {
    const path = [{ x: 0, y: 0 }, { x: 60, y: 0 }];
    const avoid = { x: 60, y: 0, radius: 35 };
    const at = placeLabel(path, PILL, avoid)!;
    expect(gapToBox(at, PILL, avoid)).toBeGreaterThanOrEqual(avoid.radius + LABEL_LOOK.gap);
    expect(at.x).toBeCloseTo(30);
  });

  it('stands above the point of a path without length, and nowhere without a point', () => {
    expect(placeLabel([{ x: 10, y: 10 }], PILL)).toEqual({ x: 10, y: 10 - PILL.height / 2 - clearance });
    expect(placeLabel([], PILL)).toBeNull();
  });
});

describe('labelCenter', () => {
  it('places in screen pixels at the zoom, and centres over a point exactly', () => {
    expect(labelCenter({ over: { x: 10, y: 20 } }, PILL, 3)).toEqual({ x: 30, y: 60 });
    const beside = labelCenter({ beside: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }, PILL, 2)!;
    expect(beside.x).toBeCloseTo(100);
  });
});

describe('MeasureLabel', () => {
  beforeEach(() => {
    // jsdom cannot measure text.
    vi.spyOn(Text.prototype, 'getLocalBounds').mockReturnValue(new Bounds(0, 0, 40, 16));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps its size on screen at every zoom: scaled back from the world, its text at one font size and snapped to pixels', () => {
    const label = new MeasureLabel();
    for (const zoom of [0.1, 1, 3, 8]) {
      label.show('35 ft', { beside: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }, zoom);
      expect(label.view.scale.x).toBeCloseTo(1 / zoom);
      expect(label.text.style.fontSize).toBe(LABEL_LOOK.fontSize);
      // Placed in screen pixels: the same distance above the line on screen at every zoom.
      expect(label.view.position.y * zoom).toBeCloseTo(-(pillSize({ width: 40, height: 16 }).height / 2 + LABEL_LOOK.dot + 1 + LABEL_LOOK.gap));
    }
    expect(label.text.roundPixels).toBe(true);
    // Rasterised at the renderer's resolution, the device pixel ratio, as the text of the interface.
    expect(label.text.resolution).toBeNull();
    label.destroy();
  });
});
