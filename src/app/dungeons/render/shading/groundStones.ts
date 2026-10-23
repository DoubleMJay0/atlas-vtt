import { traceSmoothClosed, type Vec } from '../geometry';
import type { Stand } from '../art/heights';
import { polyPath } from '../art/paths';
import type { RenderEnv } from '../renderEnv';
import { SCATTER, scatterStones } from '../terrain/ground';
import { shownPieces } from '../terrain/pieces';

/** How tall the lowest and the tallest loose stone stand, as a share of a wall. */
const LOWEST = 0.035;
const TALLEST = 0.09;

/** A stone of `radius` cells: the larger, the taller, from `LOWEST` to `TALLEST`. */
export function stoneHeight(radius: number): number {
  return Math.min(TALLEST, Math.max(LOWEST, LOWEST + radius * 0.35));
}

/** The radius of the circle as large as the box around `points`, in cells. */
function radiusOf(points: readonly Vec[]): number {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)) / 4;
}

/**
 * The loose stones on a floor as what stands, low: the rubble of a crumbling floor (where the view
 * shows props) and the stones of scattered ground. The map's own shadows leave them out (they cast
 * none of their own there); the relief takes them, so a light casts their shadows.
 */
export function groundStones(env: RenderEnv): Stand[] {
  const { dungeon, view } = env;
  const stands: Stand[] = [];
  if (view.props) {
    for (const stone of dungeon.floor.rubble) {
      if (stone.points.length < 3) continue;
      stands.push({ height: stoneHeight(radiusOf(stone.points)), path: (ctx) => traceSmoothClosed(ctx, stone.points) });
    }
  }
  for (const piece of shownPieces(env)) {
    const scatter = SCATTER[piece.kind];
    if (!scatter) continue;
    for (const stone of scatterStones(env, piece, scatter.size, scatter.perCell)) stands.push({ height: stoneHeight(stone.r), path: polyPath(stone.poly) });
  }
  return stands;
}
