import type { ArtScene } from '../art/artScene';
import { viewBounds } from '../art/artScene';
import { mouthsOf, partedRock } from '../art/mouths';
import { fbm, valueNoise } from '../art/noise';
import { activeCells, fieldOf, sampleField } from '../art/raster';
import { hatchFill, type HatchSpec } from './hatch';
import type { Pens } from './pens';
import { CUT } from './walls';
import { grownRings, traceRings } from '../art/outline';

/**
 * The rock in burin lines: one set of parallel lines whose width carries the tone, swelling to all
 * but merge against the wall and thinning out into the paper, the reach of the shading wandering;
 * rock the floors close in on is shaded whole. It parts before every way in.
 */
export function drawRock(scene: ArtScene, pens: Pens): void {
  const { ctx, dungeon, style } = scene.env;
  const seed = dungeon.model.seed;
  const start = CUT.width(style) + CUT.gap + CUT.thin + 0.03;
  const base = style.surround.reach;
  const reach = fieldOf(scene.grid, (x, y) => base * (0.5 + 0.75 * fbm(x * 0.3, y * 0.3, seed + 1, 3)));
  const mass = fieldOf(scene.grid, (x, y) => 0.8 + 0.4 * fbm(x * 0.9, y * 0.9, seed + 2, 3));
  const parted = partedRock(mouthsOf(dungeon));
  // Worked out once on the scene's grid; the lines begin crisply where the clip below lets them.
  const tone = fieldOf(scene.grid, (x, y) => {
    const d = scene.sdfAt(x, y);
    if (d > base * 1.6 + 0.4 || d < start - 0.1) return 0;
    const u = Math.max(0, d - start) / sampleField(scene.grid, reach, x, y);
    const band = u >= 1 ? 0 : (1 - u) ** 1.25;
    const near = Math.exp(-Math.max(0, d - start) / 0.12);
    const pocket = scene.pocketAt(x, y) * 0.78;
    return Math.min(1, Math.max((band * sampleField(scene.grid, mass, x, y) * 0.8 + near * 0.35) * parted(x, y), pocket));
  });
  const spec: HatchSpec = {
    angle: pens.angle,
    spacing: pens.spacing,
    bounds: viewBounds(scene.frame),
    step: Math.max(pens.step, 0.05),
    active: activeCells(scene.grid, tone),
    minWidth: pens.minWidth,
    wobble: (x, y) => (valueNoise(x * 0.55, y * 0.55, seed + 5) - 0.5) * pens.spacing * 1.2,
    width: (x, y) => pens.spacing * 0.82 * sampleField(scene.grid, tone, x, y) ** 1.1,
  };
  ctx.save();
  ctx.beginPath();
  const g = scene.grid;
  ctx.rect(g.x0, g.y0, g.w / g.res, g.h / g.res);
  traceRings(ctx, grownRings(scene, start));
  ctx.clip('evenodd');
  hatchFill(ctx, pens.ink, spec);
  ctx.restore();
}

