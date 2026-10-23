import type { Vec } from '../geometry';
import { traceSmoothClosed } from '../geometry';
import type { ArtScene } from './artScene';
import type { Field, PathFn } from './paths';
import { gridOver, insideDistance, pathMask, sampleField } from './raster';
import { pointsBounds } from '../geometry';

/** The pools of the floor as drawn: their smoothed outlines, or none where the view hides water. */
export function poolOutlines(scene: ArtScene): Vec[][] {
  const { env } = scene;
  return env.view.water ? env.dungeon.floor.water.map(pool => pool.outline) : [];
}

export function poolsPath(outlines: readonly Vec[][]): PathFn {
  return path => outlines.forEach(outline => traceSmoothClosed(path, outline));
}

/** Distance into the shapes `trace` adds, from their shore, in cells; 0 outside. Worked out on a grid of their own. */
export function depthField(scene: ArtScene, trace: PathFn, points: readonly Vec[]): Field {
  if (!points.length) return () => 0;
  const b = pointsBounds(points);
  const grid = gridOver(b.minX - 0.5, b.minY - 0.5, b.maxX + 0.5, b.maxY + 0.5, scene.grid.res);
  const depth = insideDistance(grid, pathMask(grid, trace));
  return (x, y) => sampleField(grid, depth, x, y);
}
