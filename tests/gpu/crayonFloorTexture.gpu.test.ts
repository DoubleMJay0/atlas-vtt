import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../src/app/dungeons/generate';
import type { DungeonRequest } from '../../src/app/dungeons/model';
import { mapLayout } from '../../src/app/dungeons/render/layoutSize';
import { parseHex } from '../../src/app/dungeons/render/palette';
import { renderMap } from '../../src/app/dungeons/render/renderMap';
import { vellumColours } from '../../src/app/dungeons/render/vellum';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { DEFAULT_VIEW } from '../../src/app/dungeons/style';
import { dungeonStyle } from '../../src/app/dungeons/styleCatalog';

/**
 * Crayon colours in every floor (`render/crayon/floors.ts`, `ground.ts`): no open floor cell of any
 * theme is left the bare paper. Each map is drawn whole; every cell of floor that nothing stands on,
 * away from walls, is read over its middle (clear of the grid's lines), and counts as coloured
 * when most of its pixels lie off the vellum's colour by more than its grain, and its strokes vary.
 */

const PX = 48;
/** How far off the vellum a pixel must lie to be crayon, in RGB distance: the vellum's own grain and blotches stay well under it. */
const OFF_PAPER = 14;
/** The share of a cell's pixels off the paper for it to count as coloured. */
const COVERED = 0.6;
/**
 * Luminance spread a hand's strokes leave in a cell. Bare paper with pencilled joints reads 0.4 to
 * about 2.5 and a flat fill 0; coloured-in floors read 5 to 13, as the forest's meadow does (6 to 13).
 */
const STROKES = 4;

const CASES: [string, DungeonRequest][] = [
  ['fortress', { seed: 404, theme: 'fortress', tags: ['round', 'colonnades'], floors: 2 }],
  ['cavern', { seed: 606, theme: 'cavern', tags: ['medium', 'wet'], floors: 2 }],
  ['mansion', { seed: 16, theme: 'mansion', tags: [], floors: 2 }],
  ['mansion with cellar', { seed: 2, theme: 'mansion', tags: ['large'], floors: 3 }],
  ['forest', { seed: 606, theme: 'forest', tags: ['medium', 'dry'], floors: 1 }],
];

interface CellReading {
  covered: number;
  spread: number;
}

function readCell(data: Uint8ClampedArray, width: number, x0: number, y0: number, size: number, paper: readonly number[]): CellReading {
  let off = 0;
  let n = 0;
  let sum = 0;
  let squares = 0;
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (Math.hypot(r - paper[0]!, g - paper[1]!, b - paper[2]!) > OFF_PAPER) off++;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += l;
      squares += l * l;
      n++;
    }
  }
  const mean = sum / n;
  return { covered: off / n, spread: Math.sqrt(Math.max(0, squares / n - mean * mean)) };
}

describe('crayon floors are coloured in', () => {
  const style = dungeonStyle('crayon');
  const paper = parseHex(vellumColours(style.colors.paper).inner);
  for (const [name, request] of CASES) {
    it(name, () => {
      const model = generateDungeon(request);
      const layout = mapLayout(model, PX, DEFAULT_VIEW);
      for (let floor = 0; floor < model.floors.length; floor++) {
        const canvas = new OffscreenCanvas(layout.widthPx, layout.heightPx);
        const ctx = canvas.getContext('2d')!;
        renderMap(ctx, model, style, DEFAULT_VIEW, { pxPerCell: PX, floor });
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const dungeon = visibleDungeon(model, DEFAULT_VIEW, floor);
        const f = dungeon.floor;
        const busy = new Set([
          ...f.terrain.flatMap((p) => p.cells),
          ...f.waterCells,
          ...f.stairs.flatMap((s) => Array.from({ length: s.w * s.h }, (_, k) => ({ x: s.x + (k % s.w), y: s.y + Math.floor(k / s.w) }))),
          ...[...f.props, ...f.columns].map((p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) })),
        ].map((c) => `${c.x},${c.y}`));
        const bare: string[] = [];
        let open = 0;
        const b = dungeon.bounds;
        for (let cy = Math.floor(b.minY); cy < b.maxY; cy++) {
          for (let cx = Math.floor(b.minX); cx < b.maxX; cx++) {
            // Whole cells of floor, a cell clear of any wall, whose shade and hatching would count as colour.
            if (busy.has(`${cx},${cy}`) || dungeon.field.distance(cx + 0.5, cy + 0.5) > -1) continue;
            open++;
            const at = Math.round((cx - layout.originCell.x + 0.2) * PX);
            const top = Math.round((cy - layout.originCell.y + 0.2) * PX);
            const cell = readCell(data, canvas.width, at, top, Math.round(PX * 0.6), paper);
            if (cell.covered < COVERED || cell.spread < STROKES) bare.push(`${cx},${cy} (${cell.covered.toFixed(2)}, ${cell.spread.toFixed(1)})`);
          }
        }
        expect(open, `${name} floor ${floor}: open floor cells`).toBeGreaterThan(10);
        expect(bare, `${name} floor ${floor}: ${bare.length} of ${open} open cells left bare`).toEqual([]);
      }
    });
  }
});
