import type { FloorShape, Vec } from './geometry';

/** A place on a shape's outline: the point, the way along the outline and the way out. */
export interface EdgePlace {
  point: Vec;
  tangent: Vec;
  normal: Vec;
}

/**
 * Places along a shape's outline grown by `offset`, `step` apart from a `phase`, skipping a
 * rectangle's rounded corners; `step` is measured on the grown outline.
 */
export function edgePlaces(shape: FloorShape, offset: number, step: number, phase: number): EdgePlace[] {
  const out: EdgePlace[] = [];
  if (shape.kind === 'circle') {
    const r = shape.r + offset;
    const count = Math.max(3, Math.round((Math.PI * 2 * r) / step));
    for (let i = 0; i < count; i++) {
      const a = ((i + phase / step) / count) * Math.PI * 2;
      const normal = { x: Math.cos(a), y: Math.sin(a) };
      out.push({ point: { x: shape.cx + normal.x * r, y: shape.cy + normal.y * r }, tangent: { x: -normal.y, y: normal.x }, normal });
    }
    return out;
  }
  const x0 = shape.x;
  const y0 = shape.y;
  const x1 = shape.x + shape.w;
  const y1 = shape.y + shape.h;
  const sides: [Vec, Vec, Vec][] = [
    [{ x: x0, y: y0 - offset }, { x: 1, y: 0 }, { x: 0, y: -1 }],
    [{ x: x1 + offset, y: y0 }, { x: 0, y: 1 }, { x: 1, y: 0 }],
    [{ x: x1, y: y1 + offset }, { x: -1, y: 0 }, { x: 0, y: 1 }],
    [{ x: x0 - offset, y: y1 }, { x: 0, y: -1 }, { x: -1, y: 0 }],
  ];
  sides.forEach(([start, tangent, normal], index) => {
    const length = index % 2 === 0 ? shape.w : shape.h;
    for (let t = phase % step; t <= length + 1e-9; t += step) {
      out.push({ point: { x: start.x + tangent.x * t, y: start.y + tangent.y * t }, tangent, normal });
    }
  });
  return out;
}

/** The outline's length, grown by `offset` with round corners. */
export function outlineLength(shape: FloorShape, offset: number): number {
  if (shape.kind === 'circle') return Math.PI * 2 * (shape.r + offset);
  return 2 * (shape.w + shape.h) + Math.PI * 2 * offset;
}
