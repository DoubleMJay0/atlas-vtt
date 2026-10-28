import type { ArtScene } from '../art/artScene';
import { viewBounds } from '../art/artScene';
import { valueNoise } from '../art/noise';
import { CRAYONS } from '../crayon/colours';
import { crayonBox } from '../crayon/crayonBox';
import { crayonHand } from '../crayon/hand';
import { crayonPens } from '../crayon/pens';
import { crayonWater } from '../crayon/pools';
import { traceShape } from '../grounds/crowns';
import { crayonGroundsPaint } from '../grounds/crayonPaint';
import type { GroundsPaint } from '../grounds/paint';
import { mapLayout } from '../layoutSize';
import { mixColours, withAlpha } from '../palette';
import { drawVellum } from '../vellum';
import { drawForest, massShare } from './drawForest';

/** Dolmenwood's meadow, the light yellow-green of a forest's open ground. */
const MEADOW = '#a8a348';
/** The woods' vellum: a light green, lighter than the mass's coats, so the mass stands out as the woods' edge. */
const WOODS = '#94ab84';
/** How much stronger the woods' vellum grain is than the paper's: a mid green shows little of it. */
const WOODS_GRAIN = 3;
/** Grass growing thicker in spots. */
const GRASS = '#7f9a4a';

/**
 * Crayon's forest: the woods in two coats of green; the clearings' paper washed faintly in meadow,
 * thicker grass in spots and earth where it is worn, under the tufts; clumps in paper with graphite
 * outlines that fade into the mass and a curl along each lit part at its edge, then one coat over the
 * whole mass, leaf green at the clearing, shade green deeper in.
 */
export function paintCrayonForest(scene: ArtScene): void {
  const pens = crayonPens(scene);
  const box = crayonBox(scene);
  const hand = crayonHand(scene, pens, box);
  const { ctx, dungeon } = scene.env;
  const b = viewBounds(scene.frame, 1);
    const seed = dungeon.model.seed;
  const broad = (x: number, y: number): number => valueNoise(x * 0.18, y * 0.18, seed + 61) * 0.7 + valueNoise(x * 0.5, y * 0.5, seed + 62) * 0.3;
  const spots = (x: number, y: number): number => Math.max(0, (valueNoise(x * 1.1, y * 1.1, seed + 63) - 0.55) * 3.2);
  const lawn = crayonGroundsPaint(hand, pens, box);
  const ground: GroundsPaint = {
    ...lawn,
    lawn: (path, cells) => {
      lawn.lawn(path, cells);
      // A light touch the paper still shows through, so the clearing stays light under tokens.
      box.colourIn(path, { colour: MEADOW, cover: 0.38, passes: 2 }, (x, y) => 0.5 + 0.5 * broad(x, y), b);
      box.colourIn(path, { colour: GRASS, cover: 0.32, passes: 2 }, spots, b);
      box.colourIn(path, { colour: CRAYONS.earth, cover: 0.25, passes: 1 }, (x, y) => Math.max(0, 1 - broad(x, y) * 2.5), b);
    },
  };
  drawForest(scene, {
    hand,
    ground,
    colours: { water: pens.water, cloth: pens.floor },
    woods: () => {
      // The woods are vellum in a green, as the paper round every map is, its grain strong enough to
      // show on the tint: crayon over the woods doubled a scene's map (10 MB of lossy WebP, 6 s to
      // encode), the vellum costs about what flat colour does. Monochrome: graphite's tone of the paper.
      const green = scene.env.view.monochrome ? mixColours(pens.floor, pens.ink, 0.35) : WOODS;
      const layout = mapLayout(dungeon.model, scene.env.pxPerCell, scene.env.view);
      ctx.save();
      ctx.translate(layout.originCell.x, layout.originCell.y);
      ctx.scale(1 / scene.env.pxPerCell, 1 / scene.env.pxPerCell);
      drawVellum(ctx, green, layout, dungeon.model.seed, !scene.raster, 1, true, WOODS_GRAIN);
      ctx.restore();
    },
    trail: (path, fade) => box.colourIn(path, { colour: CRAYONS.earth, cover: 0.55, passes: 2 }, (x, y) => fade({ x, y }), b),
    clump: ({ clump, depth }) => {
      ctx.beginPath();
      traceShape(ctx, clump.shape);
      ctx.fillStyle = pens.floor;
      ctx.fill();
      const edge = (1 - massShare(depth)) ** 1.5;
      ctx.strokeStyle = withAlpha(pens.ink, 0.12 + 0.83 * edge);
      // Never thinner than a pixel and a half of the picture, or a map seen whole loses its trees' outlines under the crayon.
      ctx.lineWidth = Math.max(hand.weight('outline') * (0.6 + 0.4 * edge), (1.5 * edge) / scene.env.pxPerCell);
      ctx.stroke();
      // Reprieve's curl: the lit part's edge inked inside the clumps of the mass's edge.
      if (edge > 0.35) {
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        traceShape(ctx, clump.lit);
        ctx.strokeStyle = withAlpha(pens.ink, 0.55 * edge);
        ctx.lineWidth = hand.weight('fine');
        ctx.stroke();
        ctx.restore();
      }
    },
    finish: (mass, depthAt) => {
      const union = (path: CanvasPath): void => { for (const { clump } of mass) traceShape(path, clump.shape); };
      box.colourIn(union, { colour: CRAYONS.leaf, cover: 1, passes: 3 }, (x, y) => 1 - depthAt(x, y), b);
      box.colourIn(union, { colour: CRAYONS.shadeLeaf, cover: 1, passes: 3 }, depthAt, b);
    },
    water: (waterScene, trace, outlines, depth, deepness) => crayonWater(box)(waterScene, pens, trace, outlines, depth, false, deepness),
  });
}
