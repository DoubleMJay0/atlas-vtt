import type { ArtScene } from '../art/artScene';
import { traceShapes } from '../geometry';
import { drawFloorJoints } from '../engraved/floor';
import { paintEngraved } from '../engraved/painter';
import { clipLanes, drawRock } from '../rock';
import { crayonGroundsPaint } from '../grounds/crayonPaint';
import { CRAYONS } from './colours';
import { crayonBox, type CrayonBox } from './crayonBox';
import { crayonHand } from './hand';
import { crayonPens, plantPens } from './pens';
import { crayonWater } from './pools';

/**
 * Crayon, a map drawn in graphite on vellum and coloured in by hand, in Engraved's order: the rock's
 * hatching in clusters round the walls over a wash of earth crayon, the floor left as bare paper
 * with its joints faintly pencilled, water in blue crayon, plants tinted green, and every surface
 * coloured in with its material's crayon as it is drawn.
 */
export function paintCrayon(scene: ArtScene): void {
  const pens = crayonPens(scene);
  const box = crayonBox(scene);
  const hand = crayonHand(scene, pens, box);
  paintEngraved(scene, {
    pens,
    hand,
    plantPens: plantPens(pens),
    groundsPaint: () => crayonGroundsPaint(hand, pens, box),
    rock: (art) => {
      drawRock(art.env);
      colourRock(art, box);
    },
    floor: (art, p) => {
      box.paper(path => traceShapes(path, art.floors));
      drawFloorJoints(art, p);
    },
    water: crayonWater(box),
  });
}

/** The band of rock round the walls washed in earth crayon, fading away from the walls as the hatching does. */
function colourRock(scene: ArtScene, box: CrayonBox): void {
  const { ctx, dungeon, style } = scene.env;
  const reach = style.surround.reach;
  ctx.save();
  clipLanes(scene.env, dungeon.open);
  box.colourIn(path => traceShapes(path, dungeon.floors, reach, reach), { colour: CRAYONS.earth, cover: 0.75, passes: 2 }, (x, y) => 1 - Math.max(0, scene.sdfAt(x, y)) / reach);
  ctx.restore();
}
