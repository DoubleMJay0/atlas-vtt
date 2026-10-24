import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { FIRST_PROP_KINDS } from '../../src/app/dungeons/drawnKinds';
import type { PropKind } from '../../src/app/dungeons/model';
import { buildArtScene } from '../../src/app/dungeons/render/art/artScene';
import { drawGlyph } from '../../src/app/dungeons/render/art/glyph';
import type { Hand } from '../../src/app/dungeons/render/art/hand';
import { engravedHand } from '../../src/app/dungeons/render/engraved/hand';
import { pensOf } from '../../src/app/dungeons/render/engraved/pens';
import { glyphFit, type PropGlyph } from '../../src/app/dungeons/render/propShapes';
import { PROP_GLYPHS } from '../../src/app/dungeons/render/props/registry';
import { createRenderEnv } from '../../src/app/dungeons/render/renderEnv';
import { stoneColours } from '../../src/app/dungeons/render/stone/colours';
import { stoneHand } from '../../src/app/dungeons/render/stone/hand';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { DEFAULT_VIEW, type ArtDirection } from '../../src/app/dungeons/style';
import { dungeonStyle } from '../../src/app/dungeons/styleCatalog';
import { modelOf } from './glyphSheetModel';

/**
 * What one piece costs to draw, per painter: each kind drawn 200 times at play zoom (150 px a
 * cell), the middle of five runs. A kind of a family may cost at most twice the slowest of the
 * reference props (fountain, well, statue) in the same painter (style guide §10). The table
 * goes to `out/perf-glyph/cost.txt`.
 */

const PX = 150;
const DRAWS = 200;
const RUNS = 5;
const REFERENCE: readonly PropKind[] = ['fountain', 'well', 'statue'];
const FIRST_PROPS = new Set(FIRST_PROP_KINDS);
const LOOK: Record<ArtDirection, string> = { stone: 'parchment', engraved: 'print' };

/** A painter's hand over a canvas of one room, at play zoom, and the colours its props take for water and cloth. */
function handOf(direction: ArtDirection): { hand: Hand; canvas: OffscreenCanvas; water: string; cloth: string } {
  const canvas = new OffscreenCanvas(5 * PX, 5 * PX);
  const ctx = canvas.getContext('2d')!;
  const model = modelOf(5, 5, []);
  const style = dungeonStyle(LOOK[direction]);
  const env = createRenderEnv(ctx, visibleDungeon(model, DEFAULT_VIEW), style, DEFAULT_VIEW, PX);
  ctx.scale(PX, PX);
  const scene = buildArtScene(env, { originCell: { x: 0, y: 0 }, widthPx: canvas.width, heightPx: canvas.height, pxPerCell: PX }, [], false);
  if (direction === 'stone') {
    const c = stoneColours(env.palette, false);
    return { hand: stoneHand(scene, c), canvas, water: c.water, cloth: c.cloth };
  }
  const pens = pensOf(scene);
  return { hand: engravedHand(scene, pens), canvas, water: pens.water, cloth: pens.floor };
}

/** Milliseconds for `DRAWS` drawings of a kind, the middle of `RUNS` runs; reading a pixel waits for the canvas. */
function cost(direction: ArtDirection, kind: PropKind, glyph: PropGlyph): number {
  const { hand, canvas, water, cloth } = handOf(direction);
  const place = { x: 2.5, y: 2.5, rotation: 0, scale: 1, fit: glyphFit({ kind, scale: 1 }) };
  const read = canvas.getContext('2d')!;
  const runs: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const started = performance.now();
    for (let i = 0; i < DRAWS; i++) drawGlyph(hand, place, glyph, water, cloth);
    read.getImageData(0, 0, 1, 1);
    runs.push(performance.now() - started);
  }
  return runs.sort((a, b) => a - b)[Math.floor(RUNS / 2)]!;
}

describe('glyph cost', () => {
  it("draws every kind within twice its painter's slowest reference", async () => {
    const rows = ['painter\tkind\tms per 200\tlimit'];
    const over: string[] = [];
    for (const direction of ['stone', 'engraved'] as const) {
      const costs = new Map(Object.entries(PROP_GLYPHS).map(([kind, glyph]) => [kind as PropKind, cost(direction, kind as PropKind, glyph)]));
      const limit = 2 * Math.max(...REFERENCE.map(kind => costs.get(kind)!));
      for (const [kind, ms] of costs) {
        rows.push(`${direction}\t${kind}\t${ms.toFixed(2)}\t${FIRST_PROPS.has(kind) ? '(reference)' : limit.toFixed(2)}`);
        if (!FIRST_PROPS.has(kind) && ms > limit) over.push(`${direction} ${kind}: ${ms.toFixed(2)} ms, limit ${limit.toFixed(2)}`);
      }
    }
    await commands.writeFile('out/perf-glyph/cost.txt', `${rows.join('\n')}\n`);
    expect(over).toEqual([]);
  });
});
