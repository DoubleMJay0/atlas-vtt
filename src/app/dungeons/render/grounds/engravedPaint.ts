/**
 * Engraved's grounds, in ink on the paper alone: lawn as sparse tufts of three blades with a little
 * stipple, gravel as a close stipple of dots, and leaves as the engraver's scallops, each clump a
 * short arc cut on its side away from the light, a crown's roundness hatched on its shaded side.
 */

import { SHADOW_DIR } from '../art/light';
import type { Hand } from '../art/hand';
import { polysPath, type PathFn } from '../art/paths';
import { pointsBounds, type Bounds } from '../geometry';
import type { Pens } from '../engraved/pens';
import { scatter, type GroundsPaint } from './paint';

const SHADE_ANGLE = Math.atan2(SHADOW_DIR.y, SHADOW_DIR.x);

export function engravedGroundsPaint(hand: Hand, pens: Pens): GroundsPaint {
  const { ctx } = hand.scene.env;
  const seed = hand.scene.env.dungeon.model.seed;
  const fine = hand.weight('fine');
  const paper = (path: PathFn, bounds: Bounds, draw: () => void): void => {
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.clip();
    ctx.fillStyle = pens.floor;
    ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    ctx.fillStyle = pens.ink;
    ctx.strokeStyle = pens.ink;
    ctx.lineCap = 'round';
    draw();
    ctx.restore();
  };
  const stipple = (bounds: Bounds, per: number, salt: number, size: number): void => {
    ctx.beginPath();
    for (const p of scatter(bounds, per, seed + salt)) {
      const r = size * (0.6 + 0.6 * p.t);
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  return {
    lawn: (path, bounds) =>
      paper(path, bounds, () => {
        ctx.beginPath();
        for (const p of scatter(bounds, 3, seed + 11)) {
          const lean = (p.t - 0.5) * 0.8;
          for (const k of [-1, 0, 1]) {
            const a = -Math.PI / 2 + lean + k * 0.45;
            const len = 0.05 + (k === 0 ? 0.025 : 0);
            ctx.moveTo(p.x + k * 0.012, p.y);
            ctx.lineTo(p.x + k * 0.012 + Math.cos(a) * len, p.y + Math.sin(a) * len);
          }
        }
        ctx.lineWidth = fine * 0.8;
        ctx.stroke();
        stipple(bounds, 6, 12, 0.005);
      }),
    gravel: (path, bounds) =>
      paper(path, bounds, () => {
        // Raked gravel reads paler than the lawn: open paper with a few pebbles, each a small ring.
        ctx.beginPath();
        for (const p of scatter(bounds, 10, seed + 13)) {
          const r = 0.012 + 0.012 * p.t;
          ctx.moveTo(p.x + r, p.y);
          ctx.ellipse(p.x, p.y, r, r * 0.75, p.t * 3, 0, Math.PI * 2);
        }
        ctx.lineWidth = fine * 0.7;
        ctx.stroke();
        stipple(bounds, 8, 14, 0.005);
      }),
    foliage: (rings, clump, salt, dome) => {
      const path = polysPath(rings);
      const bounds = pointsBounds(rings.flat());
      paper(path, bounds, () => {
        ctx.beginPath();
        for (const p of scatter(bounds, 1 / (clump * 1.2) ** 2, seed + salt)) {
          const r = clump * (0.7 + 0.3 * p.t);
          const a = SHADE_ANGLE + (p.t - 0.5) * 0.6;
          ctx.moveTo(p.x + Math.cos(a - 1.25) * r, p.y + Math.sin(a - 1.25) * r);
          ctx.arc(p.x, p.y, r, a - 1.25, a + 1.25);
        }
        ctx.lineWidth = fine;
        ctx.stroke();
      });
      if (!dome) return;
      hand.solid(path, dome.centre, dome.radius, 1);
      hand.line(rings, 'outline', true);
    },
  };
}
