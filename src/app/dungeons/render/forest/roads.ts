import type { DungeonRoad } from '../../model';
import { roadField } from '../../forest/forestRoads';
import { normalAt } from '../../forest/riverShape';
import { lineRings, unionRings } from '../clipShapes';
import type { Vec } from '../geometry';

/**
 * A Forest's roads as drawn: the worn ground of the road itself, and on a cart road two wheel ruts
 * worn deeper into it, about a third of the road's width apart either way of its middle, as old
 * tracks are (paired ruts some two metres apart in a corridor of three to five).
 */

/**
 * The ground within `half` cells of a road's line, round at its ends and bends: offsetting each
 * point along its normal folds the band where the road bends tighter than `half`, and the fold's
 * reversed winding cut wedges out of the ground.
 */
export function roadBand(road: DungeonRoad, half: number): Vec[][] {
  return lineRings(road.points, half);
}

/** How far either way of the road's middle its ruts run, as a share of its width, and how wide each is, in cells. */
const RUT_SPREAD = 0.27;
const RUT_HALF = 0.06;

/** How worn a road's ground is (0..1), and its ruts. */
export const ROAD_WEAR = 0.8;
export const RUT_WEAR = 0.9;

/** The ruts of every cart road as one outline: where two roads meet their ruts run on into each other, never one band laid over another. */
export function rutRings(roads: readonly DungeonRoad[]): Vec[][] {
  return unionRings(roads.filter((road) => road.ruts).flatMap((road) => [-1, 1].flatMap((side) => lineRings(beside(road, side * RUT_SPREAD * road.width), RUT_HALF))));
}

/** The line `offset` cells to the left of a road's middle. */
function beside(road: DungeonRoad, offset: number): Vec[] {
  return road.points.map((p, i) => {
    const n = normalAt(road.points, i);
    return { x: p.x + n.x * offset, y: p.y + n.y * offset };
  });
}

/** How far a road that ends in a clearing fades out before its end, in cells: worn ground thins out where the walkers spread. */
const END_FADE = 2.2;

/** How much of a road's wear shows at `p` near its dead ends: 1 away from them, falling smoothly to nothing at the end itself. */
function deadEndFade(deadEnds: readonly Vec[], p: Vec): number {
  let fade = 1;
  for (const end of deadEnds) {
    const t = Math.min(1, Math.hypot(p.x - end.x, p.y - end.y) / END_FADE);
    fade = Math.min(fade, t * t * (3 - 2 * t));
  }
  return fade;
}

/**
 * How worn the roads' ground is at `p`: the wear of the most worn road there, each whole but near
 * its dead ends (an end in a clearing, `sdfAt` below 0, that runs into no other road), where it
 * fades out. A road that leaves the map or runs into another keeps its wear to its end.
 */
export function roadWear(roads: readonly DungeonRoad[], sdfAt: (p: Vec) => number): (p: Vec) => number {
  const each = roads.map((r, k) => {
    const others = roadField(roads.filter((_, j) => j !== k));
    const deadEnds = [r.points[0]!, r.points[r.points.length - 1]!].filter((end) => sdfAt(end) < 0 && others.distance(end.x, end.y) >= 0);
    return { field: roadField([r]), deadEnds };
  });
  return (p) => {
    let wear = 0;
    for (const { field, deadEnds } of each) if (field.distance(p.x, p.y) < 0) wear = Math.max(wear, ROAD_WEAR * deadEndFade(deadEnds, p));
    return wear;
  };
}
