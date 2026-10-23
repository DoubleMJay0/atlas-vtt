import { drawBricks } from './bricks';
import { drawColumns } from './columns';
import { drawCracks, drawRubble } from './debris';
import { drawDoors } from './doors';
import { drawDots } from './dots';
import { drawInnerShadow, drawShadingBand, drawWallsAndFloor } from './floors';
import { drawGrid } from './grid';
import { drawHatching } from './hatching';
import { fillPockets } from './pockets';
import { drawProps } from './props';
import type { RenderEnv } from './renderEnv';
import { drawStairwells } from './stairwells';
import { drawStonework } from './stonework';
import { drawWater } from './water';

/** What surrounds the walls, per hatching mode; rock the rooms close in on is shaded whole but in stippling. */
function drawSurroundings(env: RenderEnv): void {
  if (env.style.hatching.mode !== 'dots') fillPockets(env);
  switch (env.style.hatching.mode) {
    case 'hatching':
      drawShadingBand(env);
      drawHatching(env);
      return;
    case 'none':
      drawShadingBand(env);
      return;
    case 'stonework':
      drawStonework(env);
      return;
    case 'bricks':
      drawBricks(env);
      return;
    case 'dots':
      drawDots(env);
      return;
  }
}

/**
 * The floor plan, bottom to top: what surrounds the walls, walls and floor, water, grid and
 * cracks, rubble and props, the inner shadow, then doors, stairwells and columns. The context is
 * in cells; paper and labels are the caller's.
 */
export function drawDungeon(env: RenderEnv): void {
  drawSurroundings(env);
  drawWallsAndFloor(env);
  drawWater(env);
  drawGrid(env);
  drawCracks(env);
  drawRubble(env);
  drawProps(env);
  drawInnerShadow(env);
  drawDoors(env);
  drawStairwells(env);
  drawColumns(env);
}
