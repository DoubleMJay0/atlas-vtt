import { mouthLane, mouthsOf, type Mouth } from './art/mouths';
import { drawBricks } from './bricks';
import { drawDots } from './dots';
import { cellsShapes, traceShapes, tracePolygon } from './geometry';
import { houseCells } from '../geometry';
import { OUTER_WALL, windowClearing } from './houseShapes';
import { shownWindows } from './art/windows';
import { drawHatching } from './hatching';
import { narrowPockets } from './pockets';
import { withAlpha } from './palette';
import { strokeWidth, type RenderEnv } from './renderEnv';
import { drawStonework } from './stonework';

/**
 * The rock round the walls, in the look's mode (`DungeonSurround.mode`), under the walls and the
 * floor. Rock the rooms close in on is filled whole, except in stippling, which thins out alone.
 * The rock parts before every entrance, so the way leads on into the open.
 */
export function drawRock(env: RenderEnv): void {
  const { ctx } = env;
  ctx.save();
  clipLanes(env, mouthsOf(env.dungeon));
  clipToHouse(env);
  drawRockMode(env);
  ctx.restore();
}

function drawRockMode(env: RenderEnv): void {
  const { mode } = env.style.surround;
  if (mode !== 'dots') fillPockets(env);
  switch (mode) {
    case 'hatching':
      drawRockBand(env);
      drawHatching(env);
      return;
    case 'none':
      drawRockBand(env);
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

/** The band of rock colour round the walls: every floor grown by the reach, round-cornered, its edge feathered. */
function drawRockBand(env: RenderEnv): void {
  const { ctx, palette, dungeon } = env;
  const reach = env.style.surround.reach;
  ctx.save();
  ctx.fillStyle = palette.rock;
  ctx.beginPath();
  traceShapes(ctx, dungeon.floors, reach, reach);
  ctx.fill();
  ctx.strokeStyle = withAlpha(palette.rock, 0.4);
  ctx.lineWidth = strokeWidth(env, env.style.strokes.normal * 2);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Fills the narrow pockets of rock between rooms with the rock colour. */
function fillPockets(env: RenderEnv): void {
  const pockets = narrowPockets(env.dungeon, env.style.surround.reach);
  if (pockets.length === 0) return;
  const { ctx, palette } = env;
  ctx.save();
  ctx.fillStyle = palette.rock;
  ctx.beginPath();
  for (const { ring } of pockets) tracePolygon(ctx, ring);
  ctx.fill();
  ctx.restore();
}

/** Keeps drawing out of the lane before each entrance: its lane (`mouthLane`). */
function clipLanes(env: RenderEnv, mouths: readonly Mouth[]): void {
  if (mouths.length === 0) return;
  const { ctx, dungeon } = env;
  const b = dungeon.bounds;
  ctx.beginPath();
  ctx.rect(b.minX - 10, b.minY - 10, b.maxX - b.minX + 20, b.maxY - b.minY + 20);
  for (const mouth of mouths) tracePolygon(ctx, mouthLane(mouth));
  ctx.clip('evenodd');
}

/** In a house rock is wall mass alone: it lies inside the house (between its rooms and in its stacks), never round it. */
function clipToHouse(env: RenderEnv): void {
  const { floor } = env.dungeon;
  if (floor.walls !== 'edges') return;
  const cells = [...houseCells(floor)].map((key) => {
    const [x, y] = key.split(',').map(Number) as [number, number];
    return { x, y };
  });
  const { ctx } = env;
  ctx.beginPath();
  for (const shape of cellsShapes(cells)) for (const ring of shape.rings) tracePolygon(ctx, ring);
  ctx.clip('evenodd');
  // A window's cut shows no wall mass either.
  const windows = shownWindows(env.dungeon);
  if (windows.length === 0) return;
  const b = env.dungeon.bounds;
  ctx.beginPath();
  ctx.rect(b.minX - 10, b.minY - 10, b.maxX - b.minX + 20, b.maxY - b.minY + 20);
  for (const window of windows) tracePolygon(ctx, windowClearing(window, OUTER_WALL));
  ctx.clip('evenodd');
}
