import type { WallSegment } from '../../types/wallTypes';
import type { DungeonProp, PropKind } from '../model';
import type { VisibleDungeon } from '../render/visibleDungeon';
import type { DungeonView } from '../style';
import type { DungeonPlacement } from './toWalls';

/**
 * Tall objects as small closed walls in their scene, so they cast shadows in its lighting and
 * block sight without walls drawn by the GM: standing columns, statues and wells. Low ones
 * (altars, chests, sarcophagi, crates, barrels, a dais) cast none. Each outline lies inside what
 * the map draws, and keeps farther than the engine's seal tolerance from every wall and every
 * other outline, so sealing never bridges an object to a wall: light still passes between them.
 */

/** Where a tall object stands, in cells: a disc, or a square turned by `rotation`. */
export interface Footprint {
  x: number;
  y: number;
  /** A disc's radius, a square's half side. */
  size: number;
  square: boolean;
  rotation: number;
}

/**
 * The tall props, by the size of what the map draws of them at scale 1 (`render/propStone.ts`: a
 * statue's plinth, a well's ring). F's restyle of the props must keep these, or the fidelity test
 * finds the outline off the drawn object.
 */
const TALL_PROPS: Partial<Record<PropKind, { size: number; square: boolean }>> = {
  statue: { size: 0.3, square: true },
  well: { size: 0.4, square: false },
};

/** The outline's share of the footprint: inside the drawn object's ink. */
const INSET = 0.85;
/** An outline that must shrink below this share of its size to keep clear of walls casts no shadow. */
const SMALLEST = 0.4;
/** Pixels an outline keeps beyond the seal tolerance. */
const MARGIN = 1;

function propFootprint(prop: DungeonProp): Footprint | null {
  const tall = TALL_PROPS[prop.kind];
  return tall ? { x: prop.x, y: prop.y, size: tall.size * prop.scale, square: tall.square, rotation: prop.rotation } : null;
}

/** The tall objects of a floor as shown: columns standing on its floor, and tall props in its shown rooms where props are shown. */
export function tallObjects(dungeon: VisibleDungeon, view: Pick<DungeonView, 'props'>): Footprint[] {
  const columns = dungeon.floor.columns
    .filter(column => !column.shattered && dungeon.field.distance(column.x, column.y) < 0)
    .map(column => ({ x: column.x, y: column.y, size: column.radius, square: column.square, rotation: 0 }));
  const props = view.props ? dungeon.floor.props.filter(prop => dungeon.roomShapes.has(prop.room)).flatMap(prop => propFootprint(prop) ?? []) : [];
  return [...columns, ...props];
}

interface Point {
  x: number;
  y: number;
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const along = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(p.x - a.x - abx * along, p.y - a.y - aby * along);
}

/** Corners of an outline around `centre` that reach `reach` from it, in world px. */
function outlineCorners(footprint: Footprint, centre: Point, reach: number): Point[] {
  const count = footprint.square ? 4 : 8;
  // A square's corners lie at 45° from its sides; a disc's octagon has a flat top
  const start = footprint.rotation + (footprint.square ? Math.PI / 4 : Math.PI / 8);
  return Array.from({ length: count }, (_, k) => {
    const angle = start + (k * Math.PI * 2) / count;
    return { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach };
  });
}

/**
 * Closed outlines of `objects` on a floor whose walls (world px) are `walls`: each the polygon of
 * its footprint at `INSET`, made smaller where that keeps it beyond `tolerance` (the seal tolerance
 * of the scene's map) from every wall and every outline before it, left out where it would shrink
 * below `SMALLEST`. Ids begin with `id`.
 */
export function objectShadows(
  objects: readonly Footprint[],
  walls: readonly WallSegment[],
  placement: DungeonPlacement,
  tolerance: number,
  id: string,
  levels?: string[],
): Record<string, WallSegment> {
  const { originCell, pxPerCell } = placement;
  const keep = tolerance + MARGIN;
  const placed: { centre: Point; reach: number }[] = [];
  const out: Record<string, WallSegment> = {};
  for (const footprint of objects) {
    const centre = { x: (footprint.x - originCell.x) * pxPerCell, y: (footprint.y - originCell.y) * pxPerCell };
    // Every corner lies on the circle of the outline's reach, so the polygon lies within it
    const full = footprint.size * (footprint.square ? Math.SQRT2 : 1) * INSET * pxPerCell;
    const fromWalls = Math.min(Infinity, ...walls.map(wall => segmentDistance(centre, wall.p1, wall.p2)));
    const fromOutlines = Math.min(Infinity, ...placed.map(other => Math.hypot(other.centre.x - centre.x, other.centre.y - centre.y) - other.reach));
    const reach = Math.min(full, fromWalls - keep, fromOutlines - keep);
    if (reach < full * SMALLEST) continue;
    placed.push({ centre, reach });
    const n = placed.length;
    const corners = outlineCorners(footprint, centre, reach);
    corners.forEach((p1, k) => {
      const wallId = `${id}_${n}_${k + 1}`;
      out[wallId] = { id: wallId, kind: 'wall', type: 'solid', p1, p2: corners[(k + 1) % corners.length]!, chainId: `${id}_${n}`, ...(levels && { levels }) };
    });
  }
  return out;
}
