import type { ArtScene } from '../art/artScene';
import { drawColumns } from '../art/columns';
import { drawDebris } from '../art/debris';
import { drawPassages } from '../art/passages';
import { drawProps } from '../art/drawProps';
import { drawGrid } from '../grid';
import { drawTerrainGround, drawTerrainOpenings, drawTerrainStanding } from '../terrain/drawTerrain';
import { stoneColours } from './colours';
import { drawFloor } from './floor';
import { stoneHand } from './hand';
import { drawRock } from './rock';
import { drawShade } from './shade';
import { drawWallBand, drawWallEdge } from './walls';
import { drawPools } from './water';
import { drawWeathering } from './weathering';

/**
 * Stone & shadow, bottom to top: the rock, the wall's course, the floor, water, terrain on the
 * ground and raised floors, light and shade, the grid, the wall's ink, then rubble, whatever
 * stands, passages and stairs, and holes in the floor with their bridges.
 */
export function paintStone(scene: ArtScene): void {
  const { env } = scene;
  const c = stoneColours(env.palette, env.view.monochrome);
  const hand = stoneHand(scene, c);
  const colours = { water: c.water, cloth: c.cloth };
  drawRock(scene, c);
  drawWallBand(scene, c);
  drawFloor(scene, c);
  drawPools(scene, c);
  drawTerrainGround(hand, colours);
  drawWeathering(scene);
  drawShade(scene, c);
  drawGrid(env);
  drawWallEdge(scene, c);
  drawDebris(hand);
  drawProps(hand, c.water, c.cloth);
  drawTerrainStanding(hand, colours);
  drawColumns(hand);
  drawPassages(hand);
  drawTerrainOpenings(hand);
}
