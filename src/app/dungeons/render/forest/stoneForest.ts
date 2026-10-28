import type { ArtScene } from '../art/artScene';
import { viewBounds } from '../art/artScene';
import { pathBounds } from '../art/paths';
import { traceShape } from '../grounds/crowns';
import { stoneGroundsPaint } from '../grounds/stonePaint';
import { mixColours } from '../palette';
import { stoneColours } from '../stone/colours';
import { stoneHand } from '../stone/hand';
import { drawPools } from '../stone/water';
import { drawForest, massShare } from './drawForest';

/** Stone's greens: the lit tops of the clumps, their bodies and the woods' depth. */
const LIT = '#a3bd7a';
const MID = '#6a8a4c';
const DEEP = '#2f4529';

/**
 * Stone & shadow's forest: the woods its deepest green, the clearings its lawn, and each clump of the
 * mass a body from mid to deep green the deeper it stands, outlined in a darker shade of itself, with
 * its lit part towards the light. Monochrome keeps to the look's two pigments.
 */
export function paintStoneForest(scene: ArtScene): void {
  const { env } = scene;
  const c = stoneColours(env.palette, env.view.monochrome);
  const hand = stoneHand(scene, c);
  const { ctx } = env;
  const mono = env.view.monochrome;
  // Monochrome: the look's own two pigments, the floor's light and the ink's dark (`paletteOf`).
  const [lit, mid, deep] = mono ? [mixColours(c.floor, c.line, 0.1), mixColours(c.floor, c.line, 0.45), mixColours(c.floor, c.line, 0.75)] : [LIT, MID, DEEP];
  const b = viewBounds(scene.frame, 1);
  drawForest(scene, {
    hand,
    ground: stoneGroundsPaint(hand, c),
    colours: { water: c.water, cloth: c.cloth },
    woods: () => {
      ctx.fillStyle = deep;
      ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    },
    trail: (path, fade) => {
      const box = pathBounds(path);
      if (box) hand.tone((x, y) => 0.35 * fade({ x, y }), box, path, 'depth');
    },
    clump: ({ clump, depth }) => {
      const t = massShare(depth);
      const body = mixColours(mid, deep, t ** 0.7);
      // Pointed leaves round its edge, as Watabou draws a crown: the ring's crests, not its rounded scallops.
      ctx.beginPath();
      clump.ring.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = mixColours(body, '#000000', 0.35);
      ctx.lineWidth = hand.weight('fine') * 1.2;
      ctx.stroke();
      ctx.beginPath();
      traceShape(ctx, clump.lit);
      ctx.fillStyle = mixColours(lit, deep, t ** 0.9);
      ctx.fill();
    },
    finish: () => undefined,
    pools: () => drawPools(scene, c),
  });
}
