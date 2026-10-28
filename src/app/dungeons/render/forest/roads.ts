import type { DungeonRoad } from '../../model';
import { normalAt } from '../../forest/riverShape';
import { polysPath, type PathFn } from '../art/paths';
import type { Vec } from '../geometry';

/**
 * A Forest's roads as drawn: the worn ground of the road itself, and on a cart road two wheel ruts
 * worn deeper into it, about a third of the road's width apart either way of its middle, as old
 * tracks are (paired ruts some two metres apart in a corridor of three to five).
 */

/** The outline of the band `half` cells either way of a road's line, `offset` cells to its left. */
export function roadBand(road: DungeonRoad, half: number, offset = 0): Vec[] {
  const left: Vec[] = [];
  const right: Vec[] = [];
  road.points.forEach((p, i) => {
    const n = normalAt(road.points, i);
    left.push({ x: p.x + n.x * (offset + half), y: p.y + n.y * (offset + half) });
    right.push({ x: p.x + n.x * (offset - half), y: p.y + n.y * (offset - half) });
  });
  return [...left, ...right.reverse()];
}

/** How far either way of the road's middle its ruts run, as a share of its width, and how wide each is, in cells. */
const RUT_SPREAD = 0.27;
const RUT_HALF = 0.06;

/** The worn ground of every road, and the ruts of the cart roads, each a path with how strongly it is worn. */
export function roadSurfaces(roads: readonly DungeonRoad[]): { path: PathFn; wear: number }[] {
  return roads.flatMap((road) => [
    { path: polysPath([roadBand(road, road.width / 2)]), wear: road.ruts ? 0.85 : 0.7 },
    ...(road.ruts ? [-1, 1].map((side) => ({ path: polysPath([roadBand(road, RUT_HALF, side * RUT_SPREAD * road.width)]), wear: 0.9 })) : []),
  ]);
}
