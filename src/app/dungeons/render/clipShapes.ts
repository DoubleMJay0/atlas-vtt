import { inflatePolyline, inflateShape, intersectShapes, subtractShapes, unionShapes } from '../../lighting/polygonClip';
import type { QShape } from '../../types/shapeTypes';
import type { Vec } from './geometry';

/**
 * Polygon union, intersection and difference in cells, through the lighting's clipping helpers, which work on
 * integers: cells are scaled to 1/1024 of a cell, far finer than any pixel a map is drawn at.
 */
const SCALE = 1024;

export type Rings = Vec[][];

function toQ(rings: readonly (readonly Vec[])[]): QShape {
  return rings
    .filter(ring => ring.length >= 3)
    .map(ring => ring.flatMap(p => [Math.round(p.x * SCALE), Math.round(p.y * SCALE)]));
}

function fromQ(shape: QShape): Rings {
  return shape.map(ring => {
    const out: Vec[] = [];
    for (let i = 0; i < ring.length; i += 2) out.push({ x: ring[i]! / SCALE, y: ring[i + 1]! / SCALE });
    return out;
  });
}

export function unionRings(rings: readonly (readonly Vec[])[]): Rings {
  return fromQ(unionShapes(toQ(rings), []));
}

/** What `a` and `b` cover both. */
export function intersectRings(a: readonly (readonly Vec[])[], b: readonly (readonly Vec[])[]): Rings {
  return fromQ(intersectShapes(toQ(a), toQ(b)));
}

/** Rings grown by `grow` cells (shrunk where negative), holes shrinking as the outer grows, with round or square corners. */
export function grownRings(rings: readonly (readonly Vec[])[], grow: number, join: 'round' | 'miter' = 'round'): Rings {
  return fromQ(inflateShape(toQ(rings), Math.round(grow * SCALE), join));
}

/**
 * Every point within `half` cells of a line, round at its ends and bends: a band that never folds
 * where the line bends tighter than its half width, as offsetting each point along its normal does.
 */
export function lineRings(line: readonly Vec[], half: number): Rings {
  if (line.length === 0 || half <= 0) return [];
  return fromQ(inflatePolyline(line.flatMap(p => [Math.round(p.x * SCALE), Math.round(p.y * SCALE)]), Math.round(half * SCALE)));
}

/** What `a` covers and `b` does not. */
export function subtractRings(a: readonly (readonly Vec[])[], b: readonly (readonly Vec[])[]): Rings {
  return fromQ(subtractShapes(toQ(a), toQ(b)));
}
