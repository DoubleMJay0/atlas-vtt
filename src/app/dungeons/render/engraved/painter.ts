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
import { drawRock } from './rock';
import { drawShade } from './shade';
import { drawWalls } from './walls';
import { drawPools } from './water';

/**
 * Engraved, the copperplate, bottom to top: the rock's lines, the floor and its faint joints,
 * water, terrain on the ground and raised floors, hatched shadows, the grid, the wall's cut, then
 * rubble, whatever stands, passages and stairs, and holes with their bridges. Ink and its paper.
 */
export function paintEngraved(scene: ArtScene): void {
  const pens = pensOf(scene);
  const hand = engravedHand(scene, pens);
  const colours = { water: pens.water, cloth: pens.floor };
  drawRock(scene, pens);
  drawFloor(scene, pens);
  drawPools(scene, pens);
  drawTerrainGround(hand, colours);
  drawShade(scene, pens);
  drawGrid(scene.env);
  drawWalls(scene, pens);
  drawDebris(hand);
  drawProps(hand, pens.water, pens.floor);
  drawTerrainStanding(hand, colours);
  drawColumns(hand);
  drawPassages(hand);
  drawTerrainOpenings(hand);
}
