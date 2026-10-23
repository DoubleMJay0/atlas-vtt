import { mixColours, parseHex, withAlpha } from '../palette';
import { layerOf, type ArtScene } from '../art/artScene';
import type { Hand, Material } from '../art/hand';
import { shadeEdges, TO_LIGHT } from '../art/light';
import { polysPath, runsPath } from '../art/paths';
import { drawField, fieldOf, gridOver } from '../art/raster';
import { paintLayer } from '../art/strips';
import type { Vec } from '../geometry';
import type { StoneColours } from './colours';
import { drawLava } from './lava';
import { cellPattern } from './patterns';
import { grainTile, rockTile, woodTile, ROCK_TILE } from './textures';
import { paintWater } from './water';
import { lightInside } from './lightInside';

/** Line weights of Stone & shadow, in cells. */
const WEIGHTS = { heavy: 0.028, outline: 0.013, fine: 0.007 };

/** The colour of a material in the look. */
export function materialColour(c: StoneColours, material: Material): string {
  switch (material) {
    case 'wood':
      return c.wood;
    case 'rope':
      return mixColours(c.wood, c.mono ? c.floor : '#cdb88e', 0.5);
    case 'floor':
      return c.floor;
    case 'rock':
      return c.rock;
    case 'dressed':
      return c.band;
    case 'metal':
      return c.metal;
    case 'cloth':
      return c.cloth;
    default:
      return c.stone;
  }
}

/** Stone & shadow's hand: textured materials, tone as soft shade, edges lit where they face the light. */
export function stoneHand(scene: ArtScene, c: StoneColours): Hand {
  const { ctx } = scene.env;
  const hand: Hand = {
    scene,
    tone: (field, bounds, clip, kind) => {
      if (!scene.raster) return;
      const g = gridOver(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, scene.grid.res);
      const deep = kind === 'depth';
      const alpha = fieldOf(g, (x, y) => Math.min(1, field(x, y)) * (deep ? 1 : 0.8));
      const rgb = parseHex(deep ? '#000000' : c.shadow);
      paintLayer(layerOf(scene), deep || c.dark ? 'source-over' : 'multiply', layer => {
        if (clip) {
          layer.beginPath();
          clip(layer);
          layer.clip();
        }
        drawField(layer, g, rgb, alpha);
      });
    },
    surface: (path, material) => {
      ctx.save();
      ctx.beginPath();
      path(ctx);
      ctx.fillStyle = materialColour(c, material);
      ctx.fill();
      ctx.restore();
      hand.grain(path, material);
    },
    grain: (path, material) => {
      if (!scene.raster) return;
      ctx.save();
      ctx.beginPath();
      path(ctx);
      ctx.clip();
      if (material === 'rock') ctx.fillStyle = cellPattern(ctx, rockTile(), ROCK_TILE.cells);
      else if (material === 'wood' || material === 'rope') ctx.fillStyle = cellPattern(ctx, woodTile(0.12), 0.9);
      else ctx.fillStyle = cellPattern(ctx, grainTile(material === 'metal' ? 0.03 : 0.06), 1.4);
      ctx.fill();
      ctx.restore();
    },
    paint: material => {
      const fill = materialColour(c, material);
      return { fill, ink: c.dark ? mixColours(fill, '#000000', 0.65) : mixColours(fill, c.line, 0.78) };
    },
    weight: weight => WEIGHTS[weight],
    line: (runs, weight, closed) => {
      ctx.save();
      ctx.beginPath();
      runsPath(runs, closed)(ctx);
      ctx.strokeStyle = weight === 'fine' ? withAlpha(c.dark ? '#000000' : c.line, c.dark ? 0.55 : 0.55) : c.dark && weight !== 'heavy' ? mixColours(c.line, c.floor, 0.35) : c.line;
      ctx.lineWidth = WEIGHTS[weight];
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    },
    edges: (poly, raised) => edges(scene, c, poly, raised),
    solid: (path, centre, radius, strength = 1) => {
      if (!scene.raster) return;
      ctx.save();
      ctx.beginPath();
      path(ctx);
      ctx.clip();
      lightInside(ctx, c, centre, radius, strength);
      ctx.restore();
    },
    water: (pools, depth, deep) => paintWater(scene, c, polysPath(pools), pools, depth, deep),
    lava: (pools, tint) => drawLava(scene, c, pools, polysPath(pools), tint),
  };
  return hand;
}

/** A polygon's rim: the lip towards the light catches it, the other falls into shade, then an outline. */
function edges(scene: ArtScene, c: StoneColours, poly: readonly Vec[], raised: boolean): void {
  const { ctx } = scene.env;
  const lit = shadeEdges(poly, !raised, 0.2);
  const dark = shadeEdges(poly, raised, 0.2);
  const inward = raised ? 1 : -1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const stroke = (runs: Vec[][], colour: string, width: number, offset: number): void => {
    ctx.beginPath();
    runsPath(runs.map(run => run.map(p => ({ x: p.x + TO_LIGHT.x * -offset, y: p.y + TO_LIGHT.y * -offset }))))(ctx);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  stroke(lit, withAlpha(c.light, c.dark ? 0.22 : 0.6), 0.016, 0.01 * inward);
  stroke(dark, withAlpha('#000000', 0.32), 0.02, -0.01 * inward);
  ctx.beginPath();
  runsPath([poly], true)(ctx);
  ctx.strokeStyle = c.dark ? mixColours(c.line, c.floor, 0.3) : c.line;
  ctx.lineWidth = WEIGHTS.outline;
  ctx.stroke();
  ctx.restore();
}
