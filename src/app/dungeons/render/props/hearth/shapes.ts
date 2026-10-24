import { rectPoly, type PathFn } from '../../art/paths';
import type { Vec } from '../../geometry';
import { roundedRect } from '../../glyphPen';

/** All dimensions are local cells, with the room towards −y and the wall at +y. */
export interface Part { x: number; y: number; w: number; h: number }
export const HEARTH: Part = { x: 0, y: 0, w: 1.8, h: 0.82 };
/** Where a fire burns once lit: a flame overlay fits inside this clear recess, above the cold ash and fuel. */
export const HEARTH_FIREBOX: Part = { x: 0, y: 0.005, w: 1.12, h: 0.43 };

export function partPath(b: Part): PathFn {
  return path => roundedRect(path, b.x, b.y, b.w, b.h, 0.025);
}
export function partPoly(b: Part): Vec[] {
  return rectPoly({ x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h });
}
