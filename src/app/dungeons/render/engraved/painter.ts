import type { ArtScene } from '../art/artScene';
import { drawColumns } from '../art/columns';
import { drawDebris } from '../art/debris';
import { drawPassages } from '../art/passages';
import { drawProps } from '../art/drawProps';
import { drawGrid } from '../grid';
import { drawTerrainGround, drawTerrainOpenings, drawTerrainStanding } from '../terrain/drawTerrain';
import { drawFloor } from './floor';
import { engravedHand } from './hand';
import { pensOf } from './pens';
import { drawRock } from '../rock';
import { drawShade } from './shade';
import { drawWalls } from './walls';
import { drawPools } from './water';
import { engravedGrowth } from './growth';

/**
 * Engraved, the copperplate, bottom to top: the rock, the floor and its faint joints,
 * water, terrain on the ground and raised floors, moss and plants, hatched shadows, the grid,
 * climbers with the wall's cut running under their upper leaves, then rubble, whatever stands,
 * columns and what climbs them, passages and stairs, and holes with their bridges. Ink and its paper.
 */
export function paintEngraved(scene: ArtScene): void {
  const pens = pensOf(scene);
  const hand = engravedHand(scene, pens);
  const colours = { water: pens.water, cloth: pens.floor };
  const growth = engravedGrowth(scene, hand, pens);
  drawRock(scene.env);
  drawFloor(scene, pens);
  drawPools(scene, pens);
  drawTerrainGround(hand, colours);
  growth.ground();
  drawShade(scene, pens);
  drawGrid(scene.env);
  growth.climbers();
  drawWalls(scene, pens);
  growth.overWalls();
  drawDebris(hand);
  drawProps(hand, pens.water, pens.floor);
  drawTerrainStanding(hand, colours);
  drawColumns(hand);
  growth.columns();
  drawPassages(hand);
  drawTerrainOpenings(hand);
}
