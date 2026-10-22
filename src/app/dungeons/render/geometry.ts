import type { CellPoint, DungeonDoor, DungeonRoom } from '../model';

/**
 * Floor geometry in cells. A room's floor is its rectangle, or for a rotunda the circle through
 * the inner corners of its four door cells; every visible door cell but a secret one is floor too.
 */

export type Vec = CellPoint;

export type FloorShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'circle'; cx: number; cy: number; r: number };

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** What 2D drawing both a window's canvas and a worker's offscreen canvas offer. */
export type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Radius of a rotunda: the circle through the inner corners of its cardinal door cells. */
export function rotundaRadius(room: Pick<DungeonRoom, 'w'>): number {
  return Math.sqrt(room.w * room.w + 1) / 2;
}

export function roomCentre(room: Pick<DungeonRoom, 'x' | 'y' | 'w' | 'h'>): Vec {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
}

export function roomShape(room: DungeonRoom): FloorShape {
  if (!room.rotunda) return { kind: 'rect', x: room.x, y: room.y, w: room.w, h: room.h };
  const c = roomCentre(room);
  return { kind: 'circle', cx: c.x, cy: c.y, r: rotundaRadius(room) };
}

export function doorShape(door: Pick<DungeonDoor, 'x' | 'y'>): FloorShape {
  return { kind: 'rect', x: door.x, y: door.y, w: 1, h: 1 };
}

export function shapeBounds(shape: FloorShape, grow = 0): Bounds {
  if (shape.kind === 'rect') {
    return { minX: shape.x - grow, minY: shape.y - grow, maxX: shape.x + shape.w + grow, maxY: shape.y + shape.h + grow };
  }
  const r = shape.r + grow;
  return { minX: shape.cx - r, minY: shape.cy - r, maxX: shape.cx + r, maxY: shape.cy + r };
}

export function unionBounds(boxes: readonly Bounds[]): Bounds {
  const out: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const b of boxes) {
    out.minX = Math.min(out.minX, b.minX);
    out.minY = Math.min(out.minY, b.minY);
    out.maxX = Math.max(out.maxX, b.maxX);
    out.maxY = Math.max(out.maxY, b.maxY);
  }
  return out;
}

/** Signed distance from a point to a shape's edge: negative inside. */
export function shapeDistance(shape: FloorShape, x: number, y: number): number {
  if (shape.kind === 'circle') return Math.hypot(x - shape.cx, y - shape.cy) - shape.r;
  const hx = shape.w / 2;
  const hy = shape.h / 2;
  const dx = Math.abs(x - (shape.x + hx)) - hx;
  const dy = Math.abs(y - (shape.y + hy)) - hy;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0);
}

/**
 * Adds a shape as a closed subpath, grown by `grow` with round corners of that radius, all
 * clockwise on screen so a nonzero fill of many shapes is their union.
 */
export function traceShape(path: CanvasPath, shape: FloorShape, grow = 0, cornerRadius = grow): void {
  if (shape.kind === 'circle') {
    path.moveTo(shape.cx + shape.r + grow, shape.cy);
    path.arc(shape.cx, shape.cy, shape.r + grow, 0, Math.PI * 2);
    path.closePath();
    return;
  }
  const x0 = shape.x - grow;
  const y0 = shape.y - grow;
  const x1 = shape.x + shape.w + grow;
  const y1 = shape.y + shape.h + grow;
  const r = Math.max(0, Math.min(cornerRadius, (x1 - x0) / 2, (y1 - y0) / 2));
  if (r === 0) {
    path.moveTo(x0, y0);
    path.lineTo(x1, y0);
    path.lineTo(x1, y1);
    path.lineTo(x0, y1);
    path.closePath();
    return;
  }
  path.moveTo(x0 + r, y0);
  path.arcTo(x1, y0, x1, y1, r);
  path.arcTo(x1, y1, x0, y1, r);
  path.arcTo(x0, y1, x0, y0, r);
  path.arcTo(x0, y0, x1, y0, r);
  path.closePath();
}

/** Adds every shape to one path. */
export function traceShapes(path: CanvasPath, shapes: readonly FloorShape[], grow = 0, cornerRadius = grow): void {
  for (const shape of shapes) traceShape(path, shape, grow, cornerRadius);
}

/** A shape as a polygon (clockwise on screen); circles get enough corners for `pxPerCell`. */
export function shapePolygon(shape: FloorShape, grow = 0, pxPerCell = 100): Vec[] {
  if (shape.kind === 'rect') {
    const { minX, minY, maxX, maxY } = shapeBounds(shape, grow);
    return [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
  }
  const r = shape.r + grow;
  const n = Math.max(32, Math.min(512, Math.ceil((Math.PI * 2 * r * pxPerCell) / 4)));
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: shape.cx + Math.cos(a) * r, y: shape.cy + Math.sin(a) * r });
  }
  return out;
}

export function tracePolygon(path: CanvasPath, points: readonly Vec[]): void {
  const first = points[0];
  if (!first) return;
  path.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) path.lineTo(points[i]!.x, points[i]!.y);
  path.closePath();
}

/** Twice the signed area; positive when clockwise on screen (y down). */
export function signedArea2(points: readonly Vec[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

export function pointInPolygon(points: readonly Vec[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function rotate(v: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** A closed curve through the midpoints of a polygon's edges, its corners as control points. */
export function traceSmoothClosed(path: CanvasPath, points: readonly Vec[]): void {
  const n = points.length;
  if (n < 3) return;
  const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(points[n - 1]!, points[0]!);
  path.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const m = mid(p, points[(i + 1) % n]!);
    path.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  path.closePath();
}
