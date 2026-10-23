/**
 * How far each point of a liquid surface lies from its shore, as a small texture the shader reads:
 * the surface's edge fades out there (so no pixel of it is drawn hard against the map), water grows
 * deeper and lava hotter away from it. Worked out once per surface on the CPU, exactly (the distance
 * to the nearest edge), at a few texels per grid cell.
 */

import type { Point } from '../../types/visionTypes';

/** Texels per grid cell, where the surface is small enough for it. */
const TEXELS_PER_CELL = 8;
/** The longest side a field may have, in texels; a larger surface gets coarser texels. */
export const MAX_FIELD_SIDE = 512;
/** How far inside the shore the far channel still tells distances apart, in cells; deeper is all one. */
export const FAR_RANGE_CELLS = 3;
/** How far inside the shore the near channel reaches, in cells: it holds the edge's fade at fine steps. */
export const NEAR_RANGE_CELLS = 0.5;
/** Texels of margin outside the shore, so filtering at the edge reads real outside distances. */
const MARGIN_TEXELS = 2;

/**
 * A surface's distance field: texel (i, j) holds the distance of the world point
 * `origin + (i + 0.5, j + 0.5) * texel` from the shore, signed (positive inside), in two channels
 * of an `rgba8unorm` texture: red from `-outside` to `near` cells, green from 0 to `far` cells.
 */
export interface LiquidField {
  texels: Uint8Array;
  width: number;
  height: number;
  /** World point of the field's top left corner. */
  origin: Point;
  /** World pixels per texel. */
  texel: number;
  /** Cells the red channel reaches outside the shore and inside it, and the green inside it. */
  outside: number;
  near: number;
  far: number;
}

interface Edge { ax: number; ay: number; bx: number; by: number }

function distanceToEdge(px: number, py: number, edge: Edge): number {
  const dx = edge.bx - edge.ax;
  const dy = edge.by - edge.ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? Math.min(1, Math.max(0, ((px - edge.ax) * dx + (py - edge.ay) * dy) / lengthSquared)) : 0;
  return Math.hypot(px - (edge.ax + dx * t), py - (edge.ay + dy * t));
}

/** Per row of texel centres, which texels lie inside the polygon (even-odd, as a shoreline that crosses itself is drawn). */
function insideRows(edges: readonly Edge[], width: number, height: number, origin: Point, texel: number): Uint8Array {
  const inside = new Uint8Array(width * height);
  const crossings: number[] = [];
  for (let j = 0; j < height; j++) {
    const y = origin.y + (j + 0.5) * texel;
    crossings.length = 0;
    for (const edge of edges) {
      if ((edge.ay <= y) === (edge.by <= y)) continue;
      crossings.push(edge.ax + ((y - edge.ay) / (edge.by - edge.ay)) * (edge.bx - edge.ax));
    }
    crossings.sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil((crossings[k]! - origin.x) / texel - 0.5));
      const to = Math.min(width - 1, Math.floor((crossings[k + 1]! - origin.x) / texel - 0.5));
      for (let i = from; i <= to; i++) inside[j * width + i] = 1;
    }
  }
  return inside;
}

/**
 * The distance field of `polygon` (world pixels) with `holes` cut from it, on a grid of `cell` world pixels. Each texel looks
 * only at the edges in the buckets around it, which are as wide as the farthest distance it tells
 * apart, so the work grows with the surface's area and its shore, never with their product.
 */
export function liquidField(polygon: readonly Point[], cell: number, holes: readonly (readonly Point[])[] = []): LiquidField {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of polygon) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const span = Math.max(maxX - minX, maxY - minY);
  const texel = Math.max(cell / TEXELS_PER_CELL, span / (MAX_FIELD_SIDE - 2 * MARGIN_TEXELS - 1), 1e-3);
  const outside = Math.max(MARGIN_TEXELS * texel, cell * 0.1) / cell;
  const origin = { x: minX - MARGIN_TEXELS * texel, y: minY - MARGIN_TEXELS * texel };
  const width = Math.ceil((maxX - minX) / texel) + 2 * MARGIN_TEXELS + 1;
  const height = Math.ceil((maxY - minY) / texel) + 2 * MARGIN_TEXELS + 1;

  const edges: Edge[] = [polygon, ...holes].flatMap((ring) => ring.map((a, index) => {
    const b = ring[(index + 1) % ring.length]!;
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y };
  }));
  const inside = insideRows(edges, width, height, origin, texel);

  // Buckets as wide as the farthest distance told apart: an edge nearer than that to a texel lies
  // in the texel's bucket or one beside it.
  const reach = Math.max(FAR_RANGE_CELLS * cell, outside * cell);
  const bucket = Math.max(reach, texel);
  const columns = Math.max(1, Math.ceil((width * texel) / bucket));
  const rows = Math.max(1, Math.ceil((height * texel) / bucket));
  const buckets: Edge[][] = Array.from({ length: columns * rows }, () => []);
  const bucketOf = (value: number, start: number, count: number): number => Math.min(count - 1, Math.max(0, Math.floor((value - start) / bucket)));
  for (const edge of edges) {
    const x0 = bucketOf(Math.min(edge.ax, edge.bx), origin.x, columns);
    const x1 = bucketOf(Math.max(edge.ax, edge.bx), origin.x, columns);
    const y0 = bucketOf(Math.min(edge.ay, edge.by), origin.y, rows);
    const y1 = bucketOf(Math.max(edge.ay, edge.by), origin.y, rows);
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) buckets[by * columns + bx]!.push(edge);
  }

  const texels = new Uint8Array(width * height * 4);
  const nearSpan = outside + NEAR_RANGE_CELLS;
  for (let j = 0; j < height; j++) {
    const y = origin.y + (j + 0.5) * texel;
    const by = bucketOf(y, origin.y, rows);
    for (let i = 0; i < width; i++) {
      const x = origin.x + (i + 0.5) * texel;
      const bx = bucketOf(x, origin.x, columns);
      let nearest = reach;
      for (let ny = Math.max(0, by - 1); ny <= Math.min(rows - 1, by + 1); ny++) {
        for (let nx = Math.max(0, bx - 1); nx <= Math.min(columns - 1, bx + 1); nx++) {
          for (const edge of buckets[ny * columns + nx]!) nearest = Math.min(nearest, distanceToEdge(x, y, edge));
        }
      }
      const index = j * width + i;
      const cells = (inside[index] ? nearest : -nearest) / cell;
      const at = index * 4;
      texels[at] = Math.round(Math.min(1, Math.max(0, (cells + outside) / nearSpan)) * 255);
      texels[at + 1] = Math.round(Math.min(1, Math.max(0, cells / FAR_RANGE_CELLS)) * 255);
      texels[at + 3] = 255;
    }
  }
  return { texels, width, height, origin, texel, outside, near: NEAR_RANGE_CELLS, far: FAR_RANGE_CELLS };
}

/** The distance in cells a field holds at its texel (i, j), as the shader decodes it (without filtering). */
export function fieldDistance(field: LiquidField, i: number, j: number): number {
  const at = (j * field.width + i) * 4;
  const near = (field.texels[at]! / 255) * (field.outside + field.near) - field.outside;
  const far = (field.texels[at + 1]! / 255) * field.far;
  return near < field.near * 0.98 ? near : Math.max(near, far);
}
