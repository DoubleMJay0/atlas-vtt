import { describe, expect, it } from 'vitest';
import type { DungeonProp, PropKind } from '../../src/app/dungeons/model';
import type { Canvas2D } from '../../src/app/dungeons/render/geometry';
import { paletteOf } from '../../src/app/dungeons/render/palette';
import { drawDoor, drawOpening, drawStairwell, drawSteps, type PassageCell, type StairwellEnd, type StairwellRect } from '../../src/app/dungeons/render/passageGlyphs';
import { drawPropList } from '../../src/app/dungeons/render/props';
import type { RenderEnv } from '../../src/app/dungeons/render/renderEnv';
import type { VisibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { DEFAULT_VIEW, REFERENCE_CELL_PX, type DungeonStyle, type DungeonView } from '../../src/app/dungeons/style';
import { dungeonStyle, type DungeonStyleId } from '../../src/app/dungeons/styleCatalog';
import { savePng, withoutText } from './dungeonRenderHarness';

/**
 * The glyph family on one sheet: every prop and every passage, each in a small room of its own,
 * in a light, a dark and a monochrome look at 100 and 200 px per cell, written to
 * `out/dungeon-render/glyphs/` for a person to judge. Each glyph is also drawn alone, to hold that
 * it writes no text, leaves ink and stays inside its place.
 */

const PROPS: readonly PropKind[] = ['barrel', 'crate', 'chest', 'fountain', 'well', 'statue', 'sarcophagus', 'altar', 'throne', 'dais', 'tapestry'];
/** Props that stand against the wall at their origin: drawn at a room's top wall, facing down into it. */
const AGAINST_WALL: ReadonlySet<PropKind> = new Set(['dais', 'tapestry']);

const LOOKS: readonly { name: string; id: DungeonStyleId; view: DungeonView }[] = [
  { name: 'light', id: 'parchment', view: DEFAULT_VIEW },
  { name: 'dark', id: 'night', view: DEFAULT_VIEW },
  { name: 'mono', id: 'parchment', view: { ...DEFAULT_VIEW, monochrome: true } },
  { name: 'cyanotype', id: 'blueprint', view: DEFAULT_VIEW },
  { name: 'jet', id: 'contrast', view: DEFAULT_VIEW },
];

const TILE = 3;
const COLUMNS = 6;

/** The renderer's environment for drawing glyphs alone: they never read the dungeon. */
function glyphEnv(ctx: Canvas2D, style: DungeonStyle, view: DungeonView, pxPerCell: number): RenderEnv {
  return {
    ctx,
    dungeon: null as unknown as VisibleDungeon,
    style,
    view,
    palette: paletteOf(style, view),
    px: 1 / REFERENCE_CELL_PX,
    pxPerCell,
    rng: () => () => 0.5,
  };
}

/** Rooms as the renderer draws them: ink at twice the wall width around every floor, then the floors. */
function rooms(env: RenderEnv, rects: readonly [number, number, number, number][]): void {
  const { ctx, palette, style } = env;
  const wall = (style.hatching.mode === 'stonework' ? style.strokes.normal : style.strokes.thick) * env.px;
  ctx.beginPath();
  for (const [x, y, w, h] of rects) ctx.rect(x, y, w, h);
  ctx.lineWidth = wall * 2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.ink;
  ctx.stroke();
  ctx.fillStyle = palette.floor;
  ctx.fill();
  ctx.beginPath();
  for (const [x, y, w, h] of rects) {
    for (let gx = x + 1; gx < x + w; gx++) {
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
    }
    for (let gy = y + 1; gy < y + h; gy++) {
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
    }
  }
  ctx.lineWidth = env.px * 0.6;
  ctx.strokeStyle = palette.grid;
  ctx.stroke();
}

function propAt(kind: PropKind, x: number, y: number): DungeonProp {
  // As the generator places them: a dais on the wall line, a tapestry a tenth of a cell before it.
  return AGAINST_WALL.has(kind)
    ? { kind, x: x + TILE / 2, y: kind === 'tapestry' ? y + 0.1 : y, rotation: Math.PI, scale: 1, room: 0 }
    : { kind, x: x + TILE / 2, y: y + TILE / 2, rotation: 0, scale: 1, room: 0 };
}

type Passage = { kind: 'opening' | 'door' | 'steps-down' | 'steps-up'; vertical: boolean } | { kind: 'stairwell'; rect: StairwellRect; end: StairwellEnd };

const PASSAGES: readonly Passage[] = [
  { kind: 'opening', vertical: false },
  { kind: 'door', vertical: false },
  { kind: 'steps-down', vertical: false },
  { kind: 'steps-up', vertical: false },
  { kind: 'door', vertical: true },
  { kind: 'steps-down', vertical: true },
  { kind: 'stairwell', rect: { x: 1, y: 0.5, w: 1, h: 2, down: { x: 0, y: 1 } }, end: 'upper' },
  { kind: 'stairwell', rect: { x: 1, y: 0.5, w: 1, h: 2, down: { x: 0, y: 1 } }, end: 'lower' },
  { kind: 'stairwell', rect: { x: 0, y: 0.5, w: 3, h: 2, down: { x: 1, y: 0 } }, end: 'upper' },
  { kind: 'stairwell', rect: { x: 0, y: 0.5, w: 3, h: 2, down: { x: 1, y: 0 } }, end: 'lower' },
  { kind: 'stairwell', rect: { x: 0.5, y: 0, w: 2, h: 3, down: { x: 0, y: -1 } }, end: 'upper' },
  { kind: 'stairwell', rect: { x: 0.5, y: 0, w: 2, h: 3, down: { x: 0, y: -1 } }, end: 'lower' },
];

/** A passage in a tile of TILE cells: two rooms and the door cell between them, or a room with its stairwell. */
function drawPassage(env: RenderEnv, passage: Passage, x: number, y: number): void {
  if (passage.kind === 'stairwell') {
    rooms(env, [[x, y, TILE, TILE]]);
    const { rect } = passage;
    drawStairwell(env, { ...rect, x: x + rect.x, y: y + rect.y }, passage.end);
    return;
  }
  const cell: PassageCell = passage.vertical ? { x: x + 1, y: y + 1, dir: { x: 0, y: 1 } } : { x: x + 1, y: y + 1, dir: { x: 1, y: 0 } };
  rooms(env, passage.vertical ? [[x, y, TILE, 1], [x + 1, y + 1, 1, 1], [x, y + 2, TILE, 1]] : [[x, y, 1, TILE], [x + 1, y + 1, 1, 1], [x + 2, y, 1, TILE]]);
  switch (passage.kind) {
    case 'opening':
      drawOpening(env, cell);
      return;
    case 'door':
      drawDoor(env, cell);
      return;
    case 'steps-down':
      drawSteps(env, cell, true);
      return;
    case 'steps-up':
      drawSteps(env, cell, false);
  }
}

function sheet(style: DungeonStyle, view: DungeonView, pxPerCell: number): { canvas: OffscreenCanvas; texts: string[] } {
  const rows = Math.ceil(PROPS.length / COLUMNS) + Math.ceil(PASSAGES.length / COLUMNS);
  const gap = 0.6;
  const canvas = new OffscreenCanvas(Math.round((COLUMNS * (TILE + gap) + gap) * pxPerCell), Math.round((rows * (TILE + gap) + gap) * pxPerCell));
  const { ctx, texts } = withoutText(canvas.getContext('2d')!);
  const env = glyphEnv(ctx, style, view, pxPerCell);
  ctx.fillStyle = env.palette.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(pxPerCell, pxPerCell);
  const place = (index: number): [number, number] => [gap + (index % COLUMNS) * (TILE + gap), gap + Math.floor(index / COLUMNS) * (TILE + gap)];
  PROPS.forEach((kind, i) => {
    const [x, y] = place(i);
    rooms(env, [[x, y, TILE, TILE]]);
    drawPropList(env, [propAt(kind, x, y)]);
  });
  const offset = Math.ceil(PROPS.length / COLUMNS) * COLUMNS;
  PASSAGES.forEach((passage, i) => {
    const [x, y] = place(offset + i);
    drawPassage(env, passage, x, y);
  });
  return { canvas, texts };
}

/** Pixels of a canvas that are drawn at all, inside and outside a box given in pixels. */
function coverage(canvas: OffscreenCanvas, box: { minX: number; minY: number; maxX: number; maxY: number }): { inside: number; outside: number } {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  let inside = 0;
  let outside = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3]! < 16) continue;
      if (x >= box.minX && x < box.maxX && y >= box.minY && y < box.maxY) inside++;
      else outside++;
    }
  }
  return { inside, outside };
}

/** Draws one glyph alone on a clear canvas of 6 × 6 cells around it, at 60 px per cell. */
function alone(draw: (env: RenderEnv) => void): OffscreenCanvas {
  const px = 60;
  const canvas = new OffscreenCanvas(6 * px, 6 * px);
  const { ctx, texts } = withoutText(canvas.getContext('2d')!);
  const env = glyphEnv(ctx, dungeonStyle('parchment'), { ...DEFAULT_VIEW, shadow: false }, px);
  ctx.scale(px, px);
  draw(env);
  expect(texts).toEqual([]);
  return canvas;
}

/** A box in cells around (3, 3), as pixels at 60 px per cell, with a little room for strokes and shadows. */
function cellsBox(minX: number, minY: number, maxX: number, maxY: number): { minX: number; minY: number; maxX: number; maxY: number } {
  const slack = 0.12;
  return { minX: (3 + minX - slack) * 60, minY: (3 + minY - slack) * 60, maxX: (3 + maxX + slack) * 60, maxY: (3 + maxY + slack) * 60 };
}

describe('the dungeon glyphs', () => {
  for (const look of LOOKS) {
    for (const pxPerCell of [100, 200]) {
      it(`draws the specimen sheet in the ${look.name} look at ${pxPerCell} px per cell`, async () => {
        const { canvas, texts } = sheet(dungeonStyle(look.id), look.view, pxPerCell);
        expect(texts).toEqual([]);
        await savePng(canvas, `glyphs/${look.name}-${pxPerCell}`);
      });
    }
  }

  for (const kind of PROPS) {
    it(`keeps the ${kind} inside its place`, () => {
      const wall = AGAINST_WALL.has(kind);
      const canvas = alone(env => drawPropList(env, [{ kind, x: 3, y: 3, rotation: wall ? Math.PI : 0, scale: 1, room: 0 }]));
      // Against a wall the glyph lies below its origin (turned to face down); else around it, within a cell.
      const box = kind === 'dais' ? cellsBox(-1.5, 0, 1.5, 1.4) : kind === 'tapestry' ? cellsBox(-0.85, -0.12, 0.85, 0.22) : cellsBox(-0.5, -0.5, 0.5, 0.5);
      const { inside, outside } = coverage(canvas, box);
      expect(inside).toBeGreaterThan(200);
      expect(outside).toBe(0);
    });
  }

  it('keeps every passage inside its door cell and every stairwell inside its rectangle', () => {
    const cell = { x: 2.5, y: 2.5 };
    const passages: readonly ((env: RenderEnv) => void)[] = [
      env => drawOpening(env, { ...cell, dir: { x: 1, y: 0 } }),
      env => drawDoor(env, { ...cell, dir: { x: 0, y: -1 } }),
      env => drawSteps(env, { ...cell, dir: { x: -1, y: 0 } }, true),
    ];
    for (const draw of passages) {
      const { inside, outside } = coverage(alone(draw), cellsBox(-0.5, -0.5, 0.5, 0.5));
      expect(inside).toBeGreaterThan(200);
      expect(outside).toBe(0);
    }
    for (const end of ['upper', 'lower'] as const) {
      const { inside, outside } = coverage(alone(env => drawStairwell(env, { x: 2, y: 1.5, w: 2, h: 3, down: { x: 0, y: 1 } }, end)), cellsBox(-1, -1.5, 1, 1.5));
      expect(inside).toBeGreaterThan(2000);
      expect(outside).toBe(0);
    }
  });
});
