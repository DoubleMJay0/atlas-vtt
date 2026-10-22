import type { DungeonView } from '../style';
import { REFERENCE_CELL_PX } from '../style';
import { rotate, shapePolygon, type Vec } from './geometry';
import type { Rect } from './pageText';
import type { VisibleDungeon } from './visibleDungeon';

/** How the map lies on the page: page = at + scale · (R(angle) · cell − pivot). */
export interface PageMapTransform {
  /** Radians. */
  angle: number;
  /** Page pixels per cell. */
  scale: number;
  /** The rotated map's centre, in rotated cells. */
  pivot: Vec;
  /** Where that centre lies on the page. */
  at: Vec;
}

/** Turns tried by Rotate-to-fit, in degrees. */
const ANGLES = Array.from({ length: 18 }, (_, i) => -90 + i * 10);

/** The points whose bounding box is the map: floor outlines grown by the hatching. */
function outlinePoints(dungeon: VisibleDungeon, grow: number): Vec[] {
  return dungeon.floors.flatMap(shape => shapePolygon(shape, grow, 2));
}

function boxOf(points: readonly Vec[], angle: number): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const q = rotate(p, angle);
    minX = Math.min(minX, q.x);
    minY = Math.min(minY, q.y);
    maxX = Math.max(maxX, q.x);
    maxY = Math.max(maxY, q.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Fits the map into an area: turned to the angle whose bounding box suits the area best (when
 * Rotate-to-fit is on), scaled to fit; a map that would grow past the reference scale grows only
 * by the square root of that (Zoom-to-fit), or not at all.
 */
export function fitMap(dungeon: VisibleDungeon, area: Rect, view: Pick<DungeonView, 'rotateToFit' | 'zoomToFit'>, pageScale: number, grow: number): PageMapTransform {
  const points = outlinePoints(dungeon, grow);
  let best = { angle: 0, fit: -Infinity, box: boxOf(points, 0) };
  for (const degrees of view.rotateToFit ? ANGLES : [0]) {
    const angle = (degrees * Math.PI) / 180;
    const box = boxOf(points, angle);
    const fit = Math.min(area.w / Math.max(box.w, 1e-6), area.h / Math.max(box.h, 1e-6));
    // A turn must earn its place: prefer the smaller turn unless it fits clearly better.
    if (fit > best.fit * 1.01 || (Math.abs(fit - best.fit) <= best.fit * 0.01 && Math.abs(angle) < Math.abs(best.angle))) {
      best = { angle, fit, box };
    }
  }
  const reference = REFERENCE_CELL_PX * pageScale;
  const ratio = best.fit / reference;
  const scale = ratio <= 1 ? best.fit : reference * (view.zoomToFit ? Math.sqrt(ratio) : 1);
  return {
    angle: best.angle,
    scale,
    pivot: { x: best.box.x + best.box.w / 2, y: best.box.y + best.box.h / 2 },
    at: { x: area.x + area.w / 2, y: area.y + area.h / 2 },
  };
}

export function cellToPage(t: PageMapTransform, p: Vec): Vec {
  const q = rotate(p, t.angle);
  return { x: t.at.x + t.scale * (q.x - t.pivot.x), y: t.at.y + t.scale * (q.y - t.pivot.y) };
}

export function pageToCell(t: PageMapTransform, p: Vec): Vec {
  const q = { x: (p.x - t.at.x) / t.scale + t.pivot.x, y: (p.y - t.at.y) / t.scale + t.pivot.y };
  return rotate(q, -t.angle);
}

/** Sets a context so that drawing in cells lands on the page. */
export function applyPageMap(ctx: { translate(x: number, y: number): void; scale(x: number, y: number): void; rotate(a: number): void }, t: PageMapTransform): void {
  ctx.translate(t.at.x, t.at.y);
  ctx.scale(t.scale, t.scale);
  ctx.translate(-t.pivot.x, -t.pivot.y);
  ctx.rotate(t.angle);
}
