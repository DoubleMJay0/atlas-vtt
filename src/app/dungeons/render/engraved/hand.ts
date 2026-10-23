import { pointsBounds, type Bounds, type Vec } from '../geometry';
import type { ArtScene } from '../art/artScene';
import type { Hand, Material } from '../art/hand';
import { SHADOW_DIR, shadeEdges } from '../art/light';
import { polysPath, runsPath, type PathFn } from '../art/paths';
import { hatchFill } from './hatch';
import type { Pens } from './pens';
import { paintMolten, paintWater } from './water';
import { depthField } from '../art/pools';

/** Line weights of Engraved, in cells. */
const WEIGHTS = { heavy: 0.046, outline: 0.02, fine: 0.009 };

/** What each material shows as: a line texture over the floor's own colour, plain for stone. */
const TEXTURE: Partial<Record<Material, { angle: number; spacing: number; width: number }>> = {
  wood: { angle: 0, spacing: 0.55, width: 0.18 },
  rope: { angle: Math.PI / 4, spacing: 0.6, width: 0.25 },
  rock: { angle: -Math.PI / 4, spacing: 0.8, width: 0.22 },
  metal: { angle: Math.PI / 4, spacing: 0.5, width: 0.45 },
  cloth: { angle: Math.PI / 4, spacing: 0.7, width: 0.3 },
};

/** Engraved's hand: tone as line width, edges as drafting shade lines, every surface the floor's colour under its own lines. */
export function engravedHand(scene: ArtScene, pens: Pens): Hand {
  const { ctx } = scene.env;
  const hatch = (bounds: Bounds, clip: PathFn | null, angle: number, spacing: number, width: (x: number, y: number) => number, phase = 0): void => {
    ctx.save();
    if (clip) {
      ctx.beginPath();
      clip(ctx);
      ctx.clip();
    }
    hatchFill(ctx, pens.shade, { angle, spacing, phase, bounds, step: pens.step, minWidth: pens.minWidth, width });
    ctx.restore();
  };
  const hand: Hand = {
    scene,
    tone: (field, bounds, clip, kind) => {
      hatch(bounds, clip, pens.angle, pens.spacing, (x, y) => pens.spacing * 0.85 * Math.min(1, field(x, y)) ** 1.1);
      if (kind === 'depth') hatch(bounds, clip, pens.angle + Math.PI / 2, pens.spacing, (x, y) => pens.spacing * 0.85 * Math.max(0, (field(x, y) - 0.6) / 0.4), pens.spacing / 2);
    },
    surface: (path, material) => {
      ctx.save();
      ctx.beginPath();
      path(ctx);
      ctx.fillStyle = pens.floor;
      ctx.fill();
      ctx.restore();
      hand.grain(path, material);
    },
    grain: (path, material) => {
      const t = TEXTURE[material];
      if (!t) return;
      const box = boundsOf(path);
      if (!box) return;
      hatch(box, path, t.angle, pens.spacing * t.spacing, () => pens.spacing * t.spacing * t.width);
    },
    line: (runs, weight, closed) => {
      ctx.save();
      ctx.beginPath();
      runsPath(runs, closed)(ctx);
      ctx.strokeStyle = pens.ink;
      ctx.lineWidth = WEIGHTS[weight];
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    },
    edges: (poly, raised) => {
      hand.line([poly], 'outline', true);
      hand.line(shadeEdges(poly, raised), 'heavy');
    },
    solid: (path, centre, radius, strength = 1) => {
      const r = radius * 1.5;
      hatch({ minX: centre.x - r, minY: centre.y - r, maxX: centre.x + r, maxY: centre.y + r }, path, pens.angle, pens.spacing * 0.55, (x, y) => {
        const t = ((x - centre.x) * SHADOW_DIR.x + (y - centre.y) * SHADOW_DIR.y) / radius;
        return pens.spacing * 0.5 * Math.min(1, strength) * Math.max(0, Math.min(1, (t + 0.15) / 1.0)) ** 1.4;
      });
    },
    water: (pools, depth, deep) => paintWater(scene, pens, polysPath(pools), pools, depth, deep),
    lava: (pools, tint) => paintMolten(scene, pens, polysPath(pools), pools, depthField(scene, polysPath(pools), pools.flat()), tint),
    paint: () => ({ fill: pens.floor, ink: pens.ink }),
    weight: weight => WEIGHTS[weight],
  };
  return hand;
}

/** The box a path covers, in its own frame, from the points it is traced through. */
function boundsOf(path: PathFn): Bounds | null {
  const points: Vec[] = [];
  const add = (x: number, y: number): void => void points.push({ x, y });
  path({
    moveTo: add,
    lineTo: add,
    rect: (x, y, w, h) => {
      add(x, y);
      add(x + w, y + h);
    },
    arc: (x, y, r) => {
      add(x - r, y - r);
      add(x + r, y + r);
    },
    arcTo: (x1, y1) => add(x1, y1),
    quadraticCurveTo: (cx, cy, x, y) => {
      add(cx, cy);
      add(x, y);
    },
    bezierCurveTo: (_a, _b, _c, _d, x, y) => add(x, y),
    closePath: () => undefined,
    ellipse: (x, y, rx, ry) => {
      add(x - rx, y - ry);
      add(x + rx, y + ry);
    },
    roundRect: (x, y, w, h) => {
      add(x, y);
      add(x + w, y + h);
    },
  });
  return points.length ? pointsBounds(points) : null;
}
