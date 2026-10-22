import { subtractShapes, unionShapes } from '../../lighting/polygonClip';
import type { QShape } from '../../types/shapeTypes';
import type { Vec } from './geometry';

/**
 * Polygon union and difference in cells, through the lighting's clipping helpers, which work on
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

export function subtractRings(subject: readonly (readonly Vec[])[], clip: readonly (readonly Vec[])[]): Rings {
  return fromQ(subtractShapes(toQ(subject), toQ(clip)));
}

export function translateRings(rings: readonly (readonly Vec[])[], by: Vec): Rings {
  return rings.map(ring => ring.map(p => ({ x: p.x + by.x, y: p.y + by.y })));
}

/** The floor that the floor shifted by `offset` leaves uncovered, joined with `extra` rings. */
export function shadowRegion(floors: readonly (readonly Vec[])[], offset: Vec, extra: readonly (readonly Vec[])[]): Rings {
  const union = unionRings(floors);
  const strip = subtractRings(union, translateRings(union, offset));
  return extra.length ? unionRings([...strip, ...extra]) : strip;
}
