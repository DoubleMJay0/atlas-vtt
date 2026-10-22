import { unionRings } from './clipShapes';
import { pointInPolygon, shapePolygon, signedArea2, tracePolygon, type Bounds, type Vec } from './geometry';
import type { RenderEnv } from './renderEnv';
import type { VisibleDungeon } from './visibleDungeon';

/**
 * Pockets: narrow stretches of rock that rooms and doors close in on every side, such as the gap
 * between a rotunda and the rooms it lies between. The hatching band reaches a fixed distance
 * from the walls, so in a pocket wider than twice that it left a ragged island of paper inside
 * the dungeon, read as a stray floor. A pocket is rock through and through: it is shaded and
 * hatched whole, as the band would be had it met itself. Wider enclosed spaces (a courtyard a
 * loop of rooms walls in) stay open ground.
 */
export interface Pocket {
  ring: Vec[];
  bounds: Bounds;
}

/** How finely the rock's outline follows a rotunda; its edges lie under walls and floor. */
const OUTLINE_PX_PER_CELL = 30;
/** Spacing of the points that tell how far into a pocket the walls are, in cells. */
const PROBE = 0.1;

const enclosed = new WeakMap<VisibleDungeon, Pocket[]>();

/** Rock the floors close in on all sides: the holes in the union of the floors. */
export function enclosedRock(dungeon: VisibleDungeon): Pocket[] {
  const known = enclosed.get(dungeon);
  if (known) return known;
  const rings = unionRings(dungeon.floors.map(shape => shapePolygon(shape, 0, OUTLINE_PX_PER_CELL)));
  // The largest ring is an outline; holes run the other way round.
  let outward = 0;
  for (const ring of rings) {
    const area = signedArea2(ring);
    if (Math.abs(area) > Math.abs(outward)) outward = area;
  }
  const holes = rings.filter(ring => ring.length >= 3 && Math.sign(signedArea2(ring)) === -Math.sign(outward));
  const found = holes.map(ring => ({ ring, bounds: ringBounds(ring) }));
  enclosed.set(dungeon, found);
  return found;
}

/** The enclosed rock no point of which lies farther than twice `distance` from a floor. */
export function narrowPockets(dungeon: VisibleDungeon, distance: number): Pocket[] {
  return enclosedRock(dungeon).filter(pocket => isNarrow(dungeon, pocket, distance * 2));
}

/** Whether a point lies in one of `pockets`. */
export function inPocket(pockets: readonly Pocket[], x: number, y: number): boolean {
  return pockets.some(({ ring, bounds }) => x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY && pointInPolygon(ring, x, y));
}

/** Fills the narrow pockets with the shading colour, under whatever surrounds the walls. */
export function fillPockets(env: RenderEnv): void {
  const pockets = narrowPockets(env.dungeon, env.style.hatching.distance);
  if (pockets.length === 0) return;
  const { ctx, palette } = env;
  ctx.save();
  ctx.fillStyle = palette.shading;
  ctx.beginPath();
  for (const { ring } of pockets) tracePolygon(ctx, ring);
  ctx.fill();
  ctx.restore();
}

/** Whether no point of a pocket lies farther than `reach` from a floor. */
function isNarrow(dungeon: VisibleDungeon, { ring, bounds }: Pocket, reach: number): boolean {
  for (let y = bounds.minY + PROBE / 2; y < bounds.maxY; y += PROBE) {
    for (let x = bounds.minX + PROBE / 2; x < bounds.maxX; x += PROBE) {
      if (dungeon.field.distance(x, y) > reach && pointInPolygon(ring, x, y)) return false;
    }
  }
  return true;
}

function ringBounds(ring: readonly Vec[]): Bounds {
  const out: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of ring) {
    out.minX = Math.min(out.minX, p.x);
    out.minY = Math.min(out.minY, p.y);
    out.maxX = Math.max(out.maxX, p.x);
    out.maxY = Math.max(out.maxY, p.y);
  }
  return out;
}
