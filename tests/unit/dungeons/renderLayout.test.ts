import { describe, expect, it } from 'vitest';
import { hatchStrokes } from '../../../src/app/dungeons/render/hatching';
import { MAX_MAP_PIXELS, MAX_MAP_SIDE, mapLayout, maxPxPerCell, suggestedPxPerCell } from '../../../src/app/dungeons/render/layoutSize';
import { placeBoxes } from '../../../src/app/dungeons/render/notePlacement';
import { legibleStyle } from '../../../src/app/dungeons/render/legibleStyle';
import { rectMeetsPolygon } from '../../../src/app/dungeons/render/boxGeometry';
import { cellToPage, fitMap, pageToCell } from '../../../src/app/dungeons/render/pageMap';
import { createRenderEnv } from '../../../src/app/dungeons/render/renderEnv';
import { roomsByDistance } from '../../../src/app/dungeons/render/roomLabels';
import { cssFont } from '../../../src/app/dungeons/render/fonts';
import { visibleDungeon } from '../../../src/app/dungeons/render/visibleDungeon';
import type { Canvas2D } from '../../../src/app/dungeons/render/geometry';
import { rngFrom } from '../../../src/app/dungeons/rng';
import { DEFAULT_VIEW, STYLE_PRESETS } from '../../../src/app/dungeons/style';
import { largeDungeon, smallDungeon } from '../../fixtures/dungeonModels';
import { addRoom, emptyModel } from '../../fixtures/dungeonModelBuilder';

/** Hatching only computes; no layer draws in these tests. */
const NO_CANVAS = {} as Canvas2D;

function crosses(s: readonly number[], i: number, j: number): boolean {
  const [ax, ay, bx, by] = [s[i]!, s[i + 1]!, s[i + 2]!, s[i + 3]!];
  const [cx, cy, dx, dy] = [s[j]!, s[j + 1]!, s[j + 2]!, s[j + 3]!];
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

describe('dungeon hatching', () => {
  it('weaves clusters whose strokes never cross one another, the same for the same seed', () => {
    const dungeon = visibleDungeon(smallDungeon(), DEFAULT_VIEW);
    const env = createRenderEnv(NO_CANVAS, dungeon, STYLE_PRESETS.parchment, DEFAULT_VIEW, 100);
    const strokes = hatchStrokes(env);
    expect(strokes.length / 4).toBeGreaterThan(500);
    let crossings = 0;
    for (let i = 0; i < strokes.length; i += 4) {
      for (let j = i + 4; j < strokes.length; j += 4) {
        if (Math.abs(strokes[i]! - strokes[j]!) > 1.5 || Math.abs(strokes[i + 1]! - strokes[j + 1]!) > 1.5) continue;
        if (crosses(strokes, i, j)) crossings++;
      }
    }
    expect(crossings).toBe(0);
    expect(hatchStrokes(env)).toEqual(strokes);
  });

  it('hatches a large dungeon quickly', () => {
    const dungeon = visibleDungeon(largeDungeon(), DEFAULT_VIEW);
    const env = createRenderEnv(NO_CANVAS, dungeon, STYLE_PRESETS.parchment, DEFAULT_VIEW, 100);
    const started = performance.now();
    hatchStrokes(env);
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe('dungeon map size', () => {
  it('starts the image on a cell corner with whole cells of margin', () => {
    const layout = mapLayout(smallDungeon(), 100);
    expect(Number.isInteger(layout.originCell.x)).toBe(true);
    expect(Number.isInteger(layout.originCell.y)).toBe(true);
    expect(layout.widthPx).toBe(layout.cellsWide * 100);
  });

  it('keeps a huge dungeon within the image limits', () => {
    const model = emptyModel(1, 'Vast', '');
    addRoom(model, { x: 0, y: 0, w: 400, h: 250 });
    const px = maxPxPerCell(model);
    const layout = mapLayout(model, px);
    expect(Math.max(layout.widthPx, layout.heightPx)).toBeLessThanOrEqual(MAX_MAP_SIDE);
    expect(layout.widthPx * layout.heightPx).toBeLessThanOrEqual(MAX_MAP_PIXELS);
    expect(suggestedPxPerCell(model, 100)).toBe(px);
    expect(suggestedPxPerCell(smallDungeon(), 100)).toBe(100);
  });
});

describe('dungeon page layout', () => {
  it('turns a tall map to lie along a wide page and maps points both ways', () => {
    const model = emptyModel(1, 'Tall', '');
    addRoom(model, { x: 0, y: 0, w: 3, h: 30 });
    const dungeon = visibleDungeon(model, DEFAULT_VIEW);
    const area = { x: 0, y: 0, w: 1300, h: 400 };
    const turned = fitMap(dungeon, area, { rotateToFit: true, zoomToFit: true }, 1, 0.5);
    // Within a percent of the best fit, the smaller turn wins: 80° here rather than 90°.
    expect(Math.abs(turned.angle)).toBeGreaterThanOrEqual((80 * Math.PI) / 180 - 1e-9);
    expect(fitMap(dungeon, area, { rotateToFit: false, zoomToFit: true }, 1, 0.5).angle).toBe(0);
    const p = { x: 1.25, y: 17.5 };
    const back = pageToCell(turned, cellToPage(turned, p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it('places note boxes clear of rooms and of each other, the GM’s where the GM put them', () => {
    const room = [{ x: 400, y: 300 }, { x: 600, y: 300 }, { x: 600, y: 500 }, { x: 400, y: 500 }];
    const { boxes, clashes } = placeBoxes(
      [
        { w: 150, h: 60, anchor: { x: 500, y: 400 } },
        { w: 150, h: 60, anchor: { x: 500, y: 400 } },
        { w: 100, h: 40, anchor: { x: 500, y: 400 }, manual: { x: 100, y: 100 } },
      ],
      { x: 0, y: 0, w: 1000, h: 800 },
      { polygons: [room], rects: [] },
      5,
      rngFrom(9),
    );
    expect(clashes).toBe(0);
    for (const box of boxes.slice(0, 2)) expect(rectMeetsPolygon(box, room)).toBe(false);
    expect(boxes[2]).toEqual({ x: 50, y: 80, w: 100, h: 40 });
  });

  it('places a note box beside its own room rather than a neighbour', () => {
    const west = [{ x: 200, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 500 }, { x: 200, y: 500 }];
    const east = [{ x: 600, y: 300 }, { x: 800, y: 300 }, { x: 800, y: 500 }, { x: 600, y: 500 }];
    const { boxes } = placeBoxes(
      [{ w: 120, h: 60, anchor: { x: 700, y: 400 }, room: 1 }],
      { x: 0, y: 0, w: 1000, h: 800 },
      { polygons: [west, east], rects: [] },
      5,
      rngFrom(4),
    );
    const box = boxes[0]!;
    const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    expect(Math.hypot(centre.x - 700, centre.y - 400)).toBeLessThan(Math.hypot(centre.x - 300, centre.y - 400));
    expect(Math.hypot(centre.x - 700, centre.y - 400)).toBeLessThan(220);
  });

  it('keeps hatching and strokes from shrinking to hairlines on a small map', () => {
    const style = STYLE_PRESETS.parchment;
    expect(legibleStyle(style, 30)).toBe(style);
    const small = legibleStyle(style, 12);
    expect(small.hatching.distance * 12).toBeGreaterThan(style.hatching.distance * 12 * 1.5);
    expect(small.hatching.distance * 12).toBeLessThan(style.hatching.distance * 30);
    expect(small.strokes.thick).toBeGreaterThan(style.strokes.thick);
  });

  it('numbers rooms nearest the entrance first', () => {
    const order = roomsByDistance(smallDungeon());
    expect(order[0]).toBe(0);
  });

  it('names the bundled faces in canvas fonts', () => {
    expect(cssFont({ face: 'title', size: 48, bold: true, italic: false }, 48)).toMatch(/^bold 48\.00px "Atlas Germania One"/);
    expect(cssFont({ face: 'text', size: 24, bold: false, italic: true }, 12)).toMatch(/^italic 12\.00px "Atlas Pathway Gothic One"/);
  });
});
