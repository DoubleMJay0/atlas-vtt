// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Container, Graphics, type Circle } from 'pixi.js';
import { CANVAS_INK, INK_SHADE } from '../../src/app/pixi/utils/canvasInk';
import { drawMeasureCircle, drawMeasureCone, drawMeasurement, measureLabelTarget, type MeasureRecord } from '../../src/app/pixi/utils/measureDrawing';
import { MeasureInk, darkBands } from '../../src/app/pixi/utils/measureInk';


/** The ink's three drawings: the area beneath, the dark bands and the accent. */
function layers(ink: MeasureInk): { area: Graphics; dark: Graphics; accent: Graphics; inkLayer: Container } {
  const [area, inkLayer] = ink.view.children as [Graphics, Container];
  const [dark, accent] = inkLayer.children as [Graphics, Graphics];
  return { area, dark, accent, inkLayer };
}

type Step = { action: string; data: unknown[] };

/** Each fill or stroke a Graphics was told to draw, with its style and the steps of its path. */
function drawn(graphics: Graphics): { action: string; style: Record<string, unknown>; path: Step[] }[] {
  return graphics.context.instructions.flatMap((instruction) =>
    instruction.action === 'texture'
      ? []
      : [{ action: instruction.action, style: instruction.data.style as unknown as Record<string, unknown>, path: instruction.data.path.instructions as unknown as Step[] }],
  );
}

function circleRadii(graphics: Graphics): number[] {
  return graphics.context.instructions.flatMap((instruction) =>
    instruction.action === 'texture'
      ? []
      : instruction.data.path.shapePath.shapePrimitives.filter(({ shape }) => shape.type === 'circle').map(({ shape }) => (shape as Circle).radius),
  );
}

const ACCENT = 0x7f6df2;
const start = { x: 105, y: 35 };

describe('darkBands', () => {
  it('lays the selection shade beyond the dark line, outermost first, so max blending leaves each band its own opacity', () => {
    const bands = darkBands(CANVAS_INK.stroke);
    const keyline = CANVAS_INK.stroke + 2 * CANVAS_INK.keyline;
    expect(bands.at(-1)).toEqual({ width: keyline, alpha: CANVAS_INK.keylineAlpha });
    expect(bands.slice(0, -1).map((band) => band.alpha)).toEqual(INK_SHADE.map((band) => band.alpha).reverse());
    expect(bands[0]!.width).toBe(keyline + 2 * INK_SHADE.reduce((sum, band) => sum + band.width, 0));
    expect(bands.every((band, i) => i === 0 || band.width < bands[i - 1]!.width)).toBe(true);
  });
});

describe('MeasureInk', () => {
  it('draws at its size on screen: a zoom of 2 doubles the points and halves the drawing back', () => {
    const ink = new MeasureInk();
    ink.begin(2);
    drawMeasurement(ink, ACCENT, { shape: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }, 90);
    expect(ink.view.scale.x).toBe(0.5);
    const [line] = drawn(layers(ink).accent);
    expect(line!.path.map((step) => step.data.slice(0, 2))).toEqual([[0, 0], [200, 0]]);
    ink.destroy();
  });

  it('composes its dark bands and accent in a layer of their own, the bands max-blended', () => {
    const ink = new MeasureInk();
    const { dark, accent, inkLayer } = layers(ink);
    expect(inkLayer.filters).toHaveLength(1);
    expect(dark.blendMode).toBe('max');
    expect(accent.blendMode).not.toBe('max');
    ink.destroy();
  });
});

describe('drawMeasurement', () => {
  it('strokes a line once in the accent, opaque and with round ends, and marks its start with a ring and its end with a dot', () => {
    const ink = new MeasureInk();
    ink.begin(1);
    drawMeasurement(ink, ACCENT, { shape: 'line', start, end: { x: 315, y: 175 } }, 90);
    const strokes = drawn(layers(ink).accent).filter((step) => step.action === 'stroke');
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.style).toMatchObject({ width: CANVAS_INK.stroke, alpha: 1, cap: 'round', join: 'round' });
    // The end's dot, the start's ring and its white middle; nothing translucent among them.
    expect(circleRadii(layers(ink).accent)).toEqual([4, 5, 5 - CANVAS_INK.stroke]);
    expect(drawn(layers(ink).area)).toEqual([]);
    ink.destroy();
  });

  it('draws a circle as one wash inside one outline', () => {
    const ink = new MeasureInk();
    ink.begin(1);
    drawMeasurement(ink, ACCENT, { shape: 'circle', start, end: { x: 245, y: 35 } }, 90);
    expect(drawn(layers(ink).area).map((step) => step.action)).toEqual(['fill']);
    expect(circleRadii(layers(ink).area)).toEqual([140]);
    expect(drawn(layers(ink).accent).filter((step) => step.action === 'stroke')).toHaveLength(1);
    ink.destroy();
  });

  it('draws a sphere as the circle of the same reach', () => {
    const shapes = (['circle', 'sphere'] as const).map((shape) => {
      const ink = new MeasureInk();
      ink.begin(1);
      drawMeasurement(ink, ACCENT, { shape, start, end: { x: 105, y: 245 } }, 90);
      const outline = (graphics: Graphics): unknown[] => drawn(graphics).map(({ action, path }) => [action, path.map((step) => step.action)]);
      return [outline(layers(ink).area), outline(layers(ink).accent), circleRadii(layers(ink).area), circleRadii(layers(ink).accent)];
    });
    expect(shapes[1]).toEqual(shapes[0]);
  });

  // Canvas 2D (the renderer without WebGL) throws on a negative arc radius, which stops the map from rendering.
  it('draws no area before the pointer has moved, only the start', () => {
    const ink = new MeasureInk();
    ink.begin(1);
    drawMeasureCircle(ink, ACCENT, start, 0);
    drawMeasureCone(ink, ACCENT, start, start, 90);
    expect(drawn(layers(ink).area)).toEqual([]);
    expect(drawn(layers(ink).accent)).toEqual([]);
    ink.destroy();
  });

  it('outlines a cone as one closed path whose arc runs on from the apex, opened by the angle it is given', () => {
    const ink = new MeasureInk();
    ink.begin(1);
    drawMeasureCone(ink, ACCENT, start, { x: 315, y: 35 }, 60);
    const strokes = drawn(layers(ink).accent).filter((step) => step.action === 'stroke');
    expect(strokes).toHaveLength(1);
    const path = strokes[0]!.path;
    expect(path.map((step) => step.action)).toEqual(['moveTo', 'arc', 'closePath']);
    const [, , radius, from, to] = path[1]!.data as number[];
    expect(radius).toBeCloseTo(210);
    expect(to! - from!).toBeCloseTo(Math.PI / 3);
    ink.destroy();
  });
});

describe('measureLabelTarget', () => {
  const end = { x: 315, y: 175 };
  it('puts a line\'s distance beside it, a circle\'s above its centre and a cone\'s over the middle of its axis', () => {
    const at = (shape: MeasureRecord['shape']): unknown => measureLabelTarget({ shape, start, end });
    expect(at('line')).toEqual({ beside: [start, end] });
    expect(at('circle')).toEqual({ beside: [start] });
    expect(at('sphere')).toEqual({ beside: [start] });
    expect(at('cone')).toEqual({ over: { x: 210, y: 105 } });
  });
});
