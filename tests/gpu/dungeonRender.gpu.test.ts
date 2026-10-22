import { beforeAll, describe, expect, it } from 'vitest';
import type { DungeonModel } from '../../src/app/dungeons/model';
import { mapLayout } from '../../src/app/dungeons/render/layoutSize';
import { renderMap } from '../../src/app/dungeons/render/renderMap';
import { renderPage } from '../../src/app/dungeons/render/renderPage';
import { parseHex } from '../../src/app/dungeons/render/palette';
import {
  DEFAULT_VIEW,
  STYLE_PRESETS,
  type DungeonView,
  type GridStyle,
  type NotesMode,
  type StylePresetId,
} from '../../src/app/dungeons/style';
import { DUNGEON_FIXTURES } from '../fixtures/dungeonModels';
import { loadDungeonFonts, pixelStats, savePng } from './dungeonRenderHarness';

/**
 * Renders the fixtures in every preset, notes mode and grid style, checks the pictures are
 * sane and in time, and writes them as PNGs to `out/dungeon-render/` for a person to look at.
 */

const PRESETS = Object.keys(STYLE_PRESETS) as StylePresetId[];
const NOTES: NotesMode[] = ['off', 'boxes', 'tailed', 'legend', 'symbols', 'numbers'];
const GRIDS: GridStyle[] = ['off', 'dotted', 'dashed', 'solid', 'broken'];
const FIXTURES = Object.keys(DUNGEON_FIXTURES) as (keyof typeof DUNGEON_FIXTURES)[];

/** A large dungeon at 100 px per cell must render in this long. */
const MAP_BUDGET_MS = 1500;

function drawMap(model: DungeonModel, preset: StylePresetId, view: DungeonView, pxPerCell: number): { canvas: OffscreenCanvas; ms: number } {
  const layout = mapLayout(model, pxPerCell, view);
  const canvas = new OffscreenCanvas(layout.widthPx, layout.heightPx);
  const started = performance.now();
  const ctx = canvas.getContext('2d')!;
  renderMap(ctx, model, STYLE_PRESETS[preset], view, { pxPerCell, numbers: true });
  // Reading a pixel waits for the drawing to reach the canvas, so the time is the whole render.
  ctx.getImageData(0, 0, 1, 1);
  return { canvas, ms: performance.now() - started };
}

function drawPage(model: DungeonModel, preset: StylePresetId, view: DungeonView): OffscreenCanvas {
  const canvas = new OffscreenCanvas(1400, 1000);
  const layout = renderPage(canvas.getContext('2d')!, model, STYLE_PRESETS[preset], view, { width: 1400, height: 1000 });
  for (const note of layout.notes) {
    expect(note.rect.x).toBeGreaterThanOrEqual(-1);
    expect(note.rect.y).toBeGreaterThanOrEqual(-1);
    expect(note.rect.x + note.rect.w).toBeLessThanOrEqual(1401);
    expect(note.rect.y + note.rect.h).toBeLessThanOrEqual(1001);
  }
  expect(layout.rooms.length).toBeGreaterThan(0);
  return canvas;
}

function expectSane(canvas: OffscreenCanvas, preset: StylePresetId): void {
  const stats = pixelStats(canvas, parseHex(STYLE_PRESETS[preset].colors.ink));
  expect(stats.ink).toBeGreaterThan(0.005);
  expect(stats.ink).toBeLessThan(0.6);
  expect(stats.colours).toBeGreaterThan(4);
  expect(stats.transparent).toBe(0);
}

describe('dungeon renderer', () => {
  beforeAll(loadDungeonFonts);

  for (const fixture of FIXTURES) {
    for (const preset of PRESETS) {
      it(`draws the ${fixture} map in ${preset}`, async () => {
        const model = DUNGEON_FIXTURES[fixture]();
        const { canvas, ms } = drawMap(model, preset, DEFAULT_VIEW, fixture === 'large' ? 100 : 60);
        expectSane(canvas, preset);
        if (fixture === 'large') expect(ms).toBeLessThan(MAP_BUDGET_MS);
        await savePng(canvas, `map-${fixture}-${preset}`);
      });

      it(`lays out the ${fixture} page in ${preset}`, async () => {
        const canvas = drawPage(DUNGEON_FIXTURES[fixture](), preset, DEFAULT_VIEW);
        expectSane(canvas, preset);
        await savePng(canvas, `page-${fixture}-${preset}`);
      });
    }
  }

  for (const notes of NOTES) {
    for (const fixture of ['small', 'medium'] as const) {
      it(`shows notes as ${notes} on the ${fixture} page`, async () => {
        const canvas = drawPage(DUNGEON_FIXTURES[fixture](), 'parchment', { ...DEFAULT_VIEW, notes });
        expectSane(canvas, 'parchment');
        await savePng(canvas, `notes-${fixture}-${notes}`);
      });
    }
  }

  for (const grid of GRIDS) {
    for (const smallTiles of [false, true]) {
      it(`draws a ${grid} grid${smallTiles ? ' in small tiles' : ''}`, async () => {
        const { canvas } = drawMap(DUNGEON_FIXTURES.small(), 'parchment', { ...DEFAULT_VIEW, grid, smallTiles }, 60);
        expectSane(canvas, 'parchment');
        await savePng(canvas, `grid-${grid}${smallTiles ? '-small' : ''}`);
      });
    }
  }

  const variants: [string, Partial<DungeonView>][] = [
    ['monochrome', { monochrome: true }],
    ['no-secrets', { secrets: false }],
    ['no-rotation', { rotateToFit: false }],
    ['bare', { water: false, props: false, shadow: false, exits: false, titleAndStory: false }],
  ];
  for (const [name, change] of variants) {
    it(`draws the ${name} page`, async () => {
      const canvas = drawPage(DUNGEON_FIXTURES.small(), 'parchment', { ...DEFAULT_VIEW, ...change });
      expectSane(canvas, 'parchment');
      await savePng(canvas, `view-${name}`);
    });
  }

  it('leaves a transparent map transparent outside the drawing', () => {
    const model = DUNGEON_FIXTURES.small();
    const layout = mapLayout(model, 40);
    const canvas = new OffscreenCanvas(layout.widthPx, layout.heightPx);
    renderMap(canvas.getContext('2d')!, model, STYLE_PRESETS.parchment, DEFAULT_VIEW, { pxPerCell: 40, numbers: false, transparent: true });
    const corner = canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data;
    expect(corner[3]).toBe(0);
  });
});
