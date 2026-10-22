import { describe, expect, it } from 'vitest';
import { hatchStrokes } from '../../../src/app/dungeons/render/hatching';
import { MAX_MAP_PIXELS, MAX_MAP_SIDE, mapLayout, maxPxPerCell, suggestedPxPerCell } from '../../../src/app/dungeons/render/layoutSize';
import { fittedPxPerCell } from '../../../src/app/dungeons/render/renderMap';
import { legibleStyle } from '../../../src/app/dungeons/render/legibleStyle';
import { createRenderEnv } from '../../../src/app/dungeons/render/renderEnv';
import { visibleDungeon } from '../../../src/app/dungeons/render/visibleDungeon';
import type { Canvas2D } from '../../../src/app/dungeons/render/geometry';
import { DEFAULT_VIEW } from '../../../src/app/dungeons/style';
import { dungeonStyle } from '../../../src/app/dungeons/styleCatalog';
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
    const env = createRenderEnv(NO_CANVAS, dungeon, dungeonStyle('parchment'), DEFAULT_VIEW, 100);
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
    const env = createRenderEnv(NO_CANVAS, dungeon, dungeonStyle('parchment'), DEFAULT_VIEW, 100);
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
    const model = emptyModel(1);
    addRoom(model, { x: 0, y: 0, w: 400, h: 250 });
    const px = maxPxPerCell(model);
    const layout = mapLayout(model, px);
    expect(Math.max(layout.widthPx, layout.heightPx)).toBeLessThanOrEqual(MAX_MAP_SIDE);
    expect(layout.widthPx * layout.heightPx).toBeLessThanOrEqual(MAX_MAP_PIXELS);
    expect(suggestedPxPerCell(model, 100)).toBe(px);
    expect(suggestedPxPerCell(smallDungeon(), 100)).toBe(100);
  });
});

describe('dungeon preview', () => {
  it('fits the whole map into the preview, on its tighter side', () => {
    const model = emptyModel(1);
    addRoom(model, { x: 0, y: 0, w: 3, h: 30 });
    const px = fittedPxPerCell(model, DEFAULT_VIEW, 1300, 400);
    const layout = mapLayout(model, px, DEFAULT_VIEW);
    expect(layout.widthPx).toBeLessThanOrEqual(1300);
    expect(layout.heightPx).toBeLessThanOrEqual(400);
    expect(layout.heightPx).toBeGreaterThan(398);
  });

  it('keeps hatching and strokes from shrinking to hairlines on a small map', () => {
    const style = dungeonStyle('parchment');
    expect(legibleStyle(style, 30)).toBe(style);
    const small = legibleStyle(style, 12);
    expect(small.hatching.distance * 12).toBeGreaterThan(style.hatching.distance * 12 * 1.5);
    expect(small.hatching.distance * 12).toBeLessThan(style.hatching.distance * 30);
    expect(small.strokes.thick).toBeGreaterThan(style.strokes.thick);
  });
});
