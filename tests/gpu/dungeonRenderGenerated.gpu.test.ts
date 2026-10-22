import { beforeAll, describe, expect, it } from 'vitest';
import { generateDungeon } from '../../src/app/dungeons/generate';
import type { DungeonModel } from '../../src/app/dungeons/model';
import { mapLayout } from '../../src/app/dungeons/render/layoutSize';
import { parseHex } from '../../src/app/dungeons/render/palette';
import { narrowPockets, inPocket } from '../../src/app/dungeons/render/pockets';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { renderMap } from '../../src/app/dungeons/render/renderMap';
import { renderPage } from '../../src/app/dungeons/render/renderPage';
import { DEFAULT_VIEW, STYLE_PRESETS, type DungeonView, type StylePresetId } from '../../src/app/dungeons/style';
import { dungeonText } from '../../src/app/dungeons/text/dungeonText';
import { loadDungeonFonts, pixelStats, savePng } from './dungeonRenderHarness';

/**
 * Real dungeons from the generator, over seeds and tags, drawn as pages and maps in every
 * preset and written to `out/dungeon-render/` as `gen-*.png` for a person to look at.
 */

const PRESETS = Object.keys(STYLE_PRESETS) as StylePresetId[];

/** A large dungeon at 100 px per cell must render in this long. */
const MAP_BUDGET_MS = 1500;

const CASES: readonly { name: string; seed: number; tags: string[] }[] = [
  { name: 'default', seed: 458782179, tags: [] },
  { name: 'small', seed: 31337, tags: ['small'] },
  { name: 'large', seed: 777, tags: ['large'] },
  { name: 'ordered', seed: 101, tags: ['ordered'] },
  { name: 'chaotic', seed: 102, tags: ['chaotic'] },
  { name: 'round', seed: 404, tags: ['round', 'colonnades', 'temple'] },
  { name: 'colonnades', seed: 405, tags: ['colonnades', 'large'] },
  { name: 'flooded', seed: 2024, tags: ['flooded', 'tomb', 'winding'] },
  { name: 'crumbling', seed: 202, tags: ['crumbling', 'dangerous'] },
  { name: 'temple', seed: 777, tags: ['temple'] },
  { name: 'tomb', seed: 909, tags: ['tomb'] },
  { name: 'dwelling', seed: 303, tags: ['dwelling', 'deep'] },
  { name: 'secret', seed: 515, tags: ['secret'] },
  { name: 'string', seed: 616, tags: ['string'] },
  { name: 'compact', seed: 717, tags: ['compact'] },
  { name: 'winding', seed: 818, tags: ['winding', 'wet'] },
  { name: 'multilevel', seed: 919, tags: ['multi-level'] },
  { name: 'backdoor', seed: 1020, tags: ['backdoor', 'medium'] },
  { name: 'large-flooded', seed: 1121, tags: ['large', 'flooded', 'round'] },
  { name: 'small-ordered', seed: 1222, tags: ['small', 'ordered', 'treasure'] },
];

const models = new Map<string, DungeonModel>();
function modelOf(name: string): DungeonModel {
  let model = models.get(name);
  if (!model) {
    const spec = CASES.find(c => c.name === name)!;
    model = generateDungeon({ seed: spec.seed, tags: spec.tags }, dungeonText);
    models.set(name, model);
  }
  return model;
}

function expectSane(canvas: OffscreenCanvas, preset: StylePresetId): void {
  const stats = pixelStats(canvas, parseHex(STYLE_PRESETS[preset].colors.ink));
  expect(stats.ink).toBeGreaterThan(0.005);
  expect(stats.ink).toBeLessThan(0.6);
  expect(stats.transparent).toBe(0);
}

function page(model: DungeonModel, preset: StylePresetId, view: DungeonView): OffscreenCanvas {
  const canvas = new OffscreenCanvas(1400, 1000);
  const layout = renderPage(canvas.getContext('2d')!, model, STYLE_PRESETS[preset], view, { width: 1400, height: 1000 });
  for (const note of layout.notes) {
    expect(note.rect.x).toBeGreaterThanOrEqual(-1);
    expect(note.rect.y).toBeGreaterThanOrEqual(-1);
    expect(note.rect.x + note.rect.w).toBeLessThanOrEqual(1401);
    expect(note.rect.y + note.rect.h).toBeLessThanOrEqual(1001);
  }
  return canvas;
}

function map(model: DungeonModel, preset: StylePresetId, pxPerCell: number, view: DungeonView = DEFAULT_VIEW): { canvas: OffscreenCanvas; ms: number } {
  const layout = mapLayout(model, pxPerCell, view);
  const canvas = new OffscreenCanvas(layout.widthPx, layout.heightPx);
  const started = performance.now();
  const ctx = canvas.getContext('2d')!;
  renderMap(ctx, model, STYLE_PRESETS[preset], view, { pxPerCell, numbers: true });
  ctx.getImageData(0, 0, 1, 1);
  return { canvas, ms: performance.now() - started };
}

/** Points of rock the rooms close in on that the drawing left the colour of the paper. */
function paperInPockets(canvas: OffscreenCanvas, model: DungeonModel, preset: StylePresetId, pxPerCell: number): string[] {
  const style = STYLE_PRESETS[preset];
  const dungeon = visibleDungeon(model, DEFAULT_VIEW);
  const pockets = narrowPockets(dungeon, style.hatching.distance);
  const { originCell } = mapLayout(model, pxPerCell, DEFAULT_VIEW);
  const ctx = canvas.getContext('2d')!;
  const [pr, pg, pb] = parseHex(style.colors.paper);
  const out: string[] = [];
  for (const { bounds } of pockets) {
    for (let y = bounds.minY; y < bounds.maxY; y += 0.1) {
      for (let x = bounds.minX; x < bounds.maxX; x += 0.1) {
        if (!inPocket(pockets, x, y) || dungeon.field.distance(x, y) < 0.2) continue;
        const [r, g, b] = ctx.getImageData(Math.floor((x - originCell.x) * pxPerCell), Math.floor((y - originCell.y) * pxPerCell), 1, 1).data;
        if (Math.abs(r! - pr) + Math.abs(g! - pg) + Math.abs(b! - pb) < 6) out.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
    }
  }
  return out;
}

describe('generated dungeons', () => {
  beforeAll(loadDungeonFonts);

  for (const { name } of CASES) {
    it(`draws the ${name} page in parchment`, async () => {
      const canvas = page(modelOf(name), 'parchment', DEFAULT_VIEW);
      expectSane(canvas, 'parchment');
      await savePng(canvas, `gen-page-${name}-parchment`);
    });
  }

  for (const name of ['default', 'large', 'round', 'flooded', 'crumbling'] as const) {
    for (const preset of PRESETS.filter(p => p !== 'parchment')) {
      it(`draws the ${name} page in ${preset}`, async () => {
        const canvas = page(modelOf(name), preset, DEFAULT_VIEW);
        expectSane(canvas, preset);
        await savePng(canvas, `gen-page-${name}-${preset}`);
      });
    }
  }

  for (const name of ['default', 'round', 'flooded'] as const) {
    for (const preset of PRESETS) {
      it(`draws the ${name} map in ${preset}`, async () => {
        const { canvas } = map(modelOf(name), preset, 100);
        expectSane(canvas, preset);
        if (name === 'default') expect(narrowPockets(visibleDungeon(modelOf(name), DEFAULT_VIEW), 0.5).length).toBeGreaterThan(0);
        if (STYLE_PRESETS[preset].hatching.mode !== 'dots') expect(paperInPockets(canvas, modelOf(name), preset, 100)).toEqual([]);
        await savePng(canvas, `gen-map-${name}-${preset}`);
      });
    }
  }

  it('draws a large map at 100 px per cell in time', async () => {
    let worst = 0;
    for (const name of ['large', 'colonnades', 'large-flooded']) {
      const { canvas, ms } = map(modelOf(name), 'parchment', 100);
      worst = Math.max(worst, ms);
      if (name === 'large') await savePng(canvas, `gen-map-${name}-parchment`);
    }
    expect(worst).toBeLessThan(MAP_BUDGET_MS);
  });

  const views: [string, Partial<DungeonView>][] = [
    ['tailed', { notes: 'tailed' }],
    ['legend', { notes: 'legend' }],
    ['monochrome', { monochrome: true }],
    ['no-secrets', { secrets: false }],
  ];
  for (const [label, change] of views) {
    it(`draws the secret page as ${label}`, async () => {
      const canvas = page(modelOf('secret'), 'parchment', { ...DEFAULT_VIEW, ...change });
      expectSane(canvas, 'parchment');
      await savePng(canvas, `gen-view-${label}`);
    });
  }
});
