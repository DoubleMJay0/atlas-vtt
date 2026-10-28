import type { DungeonRoad } from '../../model';
import { normalAt } from '../../forest/riverShape';
import { unionRings } from '../clipShapes';
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

/** How worn a road's ground is (0..1), and its ruts. */
export const ROAD_WEAR = 0.8;
export const RUT_WEAR = 0.9;

/** The ruts of every cart road as one outline: where two roads meet their ruts run on into each other, never one band laid over another. */
export function rutRings(roads: readonly DungeonRoad[]): Vec[][] {
  return unionRings(roads.filter((road) => road.ruts).flatMap((road) => [-1, 1].map((side) => roadBand(road, RUT_HALF, side * RUT_SPREAD * road.width))));
}
