import type { ArtScene } from '../art/artScene';
import { viewBounds } from '../art/artScene';
import { engravedHand } from '../engraved/hand';
import { pensOf } from '../engraved/pens';
import { drawPools } from '../engraved/water';
import { pathBounds } from '../art/paths';
import { traceShape } from '../grounds/crowns';
import { engravedGroundsPaint } from '../grounds/engravedPaint';
import { withAlpha } from '../palette';
import { drawForest, massShare } from './drawForest';

/**
 * Engraved's forest: the woods cut in the hatch the shade is cut in, as dark as it goes; each clump of
 * the mass paper with an ink outline that lightens into the mass, the lit part's edge cut at the
 * clearing; then the whole mass hatched the deeper it stands, so it sinks into the woods.
 */
export function paintEngravedForest(scene: ArtScene): void {
  const pens = pensOf(scene);
  const hand = engravedHand(scene, pens);
  const { ctx } = scene.env;
  const b = viewBounds(scene.frame, 1);
  drawForest(scene, {
    hand,
    ground: engravedGroundsPaint(hand, pens),
    colours: { water: pens.water, cloth: pens.floor },
    woods: () => {
      ctx.fillStyle = pens.floor;
      ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
      hand.tone(() => 0.85, b, null, 'shade');
    },
    trail: (path, fade) => {
      const box = pathBounds(path);
      if (box) hand.tone((x, y) => 0.25 * fade({ x, y }), box, path, 'shade');
    },
    clump: ({ clump, depth }) => {
      const edge = 1 - massShare(depth);
      ctx.beginPath();
      traceShape(ctx, clump.shape);
      ctx.fillStyle = pens.floor;
      ctx.fill();
      ctx.strokeStyle = withAlpha(pens.ink, 0.3 + 0.7 * edge);
      ctx.lineWidth = hand.weight('outline') * (0.7 + 0.3 * edge);
      ctx.stroke();
      if (edge > 0.5) {
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        traceShape(ctx, clump.lit);
        ctx.strokeStyle = withAlpha(pens.ink, 0.6 * edge);
        ctx.lineWidth = hand.weight('fine');
        ctx.stroke();
        ctx.restore();
      }
    },
    finish: (mass, depth) => {
      const union = (path: CanvasPath): void => { for (const { clump } of mass) traceShape(path, clump.shape); };
      hand.tone((x, y) => 0.75 * depth(x, y) ** 1.3, b, union, 'shade');
    },
    pools: () => drawPools(scene, pens),
  });
}
