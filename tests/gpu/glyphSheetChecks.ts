import type { DungeonModel } from '../../src/app/dungeons/model';
import { PROP_SPECS } from '../../src/app/dungeons/props/catalogue';
import { rotate } from '../../src/app/dungeons/render/geometry';
import { luminance, parseHex, paletteOf } from '../../src/app/dungeons/render/palette';
import { renderMap } from '../../src/app/dungeons/render/renderMap';
import type { DungeonStyle, DungeonView } from '../../src/app/dungeons/style';
import { withoutText } from './dungeonRenderHarness';
import type { PlacedPiece } from './glyphSheetModel';

/** What the glyph sheets measure: a room drawn alone, a piece's ink against its footprint and floor, monochrome's two colours. */

/** How far ink may reach past a piece's footprint, in cells (style guide §6). */
export const FOOTPRINT_SLACK = 0.06;
/** How far apart in luminance a piece's outline and its floor must be. */
export const OUTLINE_CONTRAST = 40;
/** How far a monochrome pixel may lie from the mixes of its colours. */
const MONO_SLACK = 6;
/** A wall piece hangs 0.1 off its wall and keeps within the 0.15 cells of the wall's course. */
const WALL_OFF = 0.1;
const WALL_BAND = 0.15;

export interface Drawn {
  canvas: OffscreenCanvas;
  texts: string[];
  /** The cell at the picture's corner. */
  origin: { x: number; y: number };
  px: number;
}

/** A part of the map, `cells` × `rows` from the cell (x, y), at `px` a cell. */
export interface CellWindow {
  x: number;
  y: number;
  cells: number;
  rows: number;
}

export function drawWindow(model: DungeonModel, style: DungeonStyle, view: DungeonView, px: number, window: CellWindow, floor = 0): Drawn {
  const origin = { x: window.x, y: window.y };
  const canvas = new OffscreenCanvas(Math.round(window.cells * px), Math.round(window.rows * px));
  const { ctx, texts } = withoutText(canvas.getContext('2d')!);
  renderMap(ctx, model, style, view, { pxPerCell: px, floor, window: { originCell: origin, widthPx: canvas.width, heightPx: canvas.height } });
  return { canvas, texts, origin, px };
}

/** A room of `w` × `h` cells from (0, 0) and a cell of its surround, at `px` a cell. */
export function drawRoom(model: DungeonModel, style: DungeonStyle, view: DungeonView, px: number, w: number, h: number): Drawn {
  return drawWindow(model, style, view, px, { x: -1, y: -1, cells: w + 2, rows: h + 2 });
}

function pixels(canvas: OffscreenCanvas): Uint8ClampedArray {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
}

/** Pixels where a piece drawn alone differs from its room drawn empty. */
export function inkMask(alone: Drawn, empty: Drawn): { mask: Uint8Array; a: Uint8ClampedArray; b: Uint8ClampedArray } {
  const a = pixels(alone.canvas);
  const b = pixels(empty.canvas);
  const mask = new Uint8Array(a.length / 4);
  for (let i = 0; i < mask.length; i++) {
    const d = Math.abs(a[i * 4]! - b[i * 4]!) + Math.abs(a[i * 4 + 1]! - b[i * 4 + 1]!) + Math.abs(a[i * 4 + 2]! - b[i * 4 + 2]!);
    mask[i] = d > 24 ? 1 : 0;
  }
  return { mask, a, b };
}

/** How far a pixel's centre lies outside the piece's footprint, in cells; 0 inside. */
function overshoot(placed: PlacedPiece, x: number, y: number): number {
  const { prop, fit } = placed;
  const local = rotate({ x: x - prop.x, y: y - prop.y }, -prop.rotation);
  const lx = local.x / prop.scale;
  const ly = local.y / prop.scale;
  const spec = PROP_SPECS[prop.kind];
  if ('reach' in spec.footprint) return Math.max(0, Math.hypot(lx, ly) - fit.along / 2);
  const ox = Math.max(0, Math.abs(lx) - fit.along / 2);
  const oy = spec.wallPiece ? Math.max(0, ly - WALL_OFF, WALL_OFF - WALL_BAND - ly) : Math.max(0, Math.abs(ly) - fit.out / 2);
  return Math.max(ox, oy);
}

/** The farthest any of a piece's ink reaches past its footprint, in cells. */
export function farthestInk(drawn: Drawn, mask: Uint8Array, placed: PlacedPiece): number {
  const { canvas, origin, px } = drawn;
  let worst = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = origin.x + ((i % canvas.width) + 0.5) / px;
    const y = origin.y + (Math.floor(i / canvas.width) + 0.5) / px;
    worst = Math.max(worst, overshoot(placed, x, y));
  }
  return worst;
}

/**
 * How far apart in luminance a piece's outline and its floor lie: the three-quarter mark over
 * the ink at the edge of what it draws, against the floor's middle luminance under it.
 */
export function outlineContrast(drawn: Drawn, ink: { mask: Uint8Array; a: Uint8ClampedArray; b: Uint8ClampedArray }, ring: number): number {
  const { width, height } = drawn.canvas;
  const { mask, a, b } = ink;
  const lum = (data: Uint8ClampedArray, i: number): number => luminance([data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!]);
  const floor: number[] = [];
  const edge: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    floor.push(lum(b, i));
    const x = i % width;
    const y = Math.floor(i / width);
    let outside = false;
    for (let dy = -ring; dy <= ring && !outside; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
          outside = true;
          break;
        }
      }
    }
    if (outside) edge.push(lum(a, i));
  }
  if (!edge.length) return 0;
  floor.sort((p, q) => p - q);
  const under = floor[Math.floor(floor.length / 2)]!;
  const apart = edge.map(l => Math.abs(l - under)).sort((p, q) => p - q);
  return apart[Math.floor(apart.length * 0.75)]!;
}

type Vec3 = [number, number, number];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function segmentDistance(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  const d = sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]);
  return Math.sqrt(dot(d, d));
}

/** How far a colour lies from every mix of three colours (the triangle they span). */
function triangleDistance(p: Vec3, a: Vec3, b: Vec3, c: Vec3): number {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d00 = dot(ab, ab);
  const d01 = dot(ab, ac);
  const d11 = dot(ac, ac);
  const det = d00 * d11 - d01 * d01;
  if (det > 1e-6) {
    const v = (d11 * dot(ap, ab) - d01 * dot(ap, ac)) / det;
    const w = (d00 * dot(ap, ac) - d01 * dot(ap, ab)) / det;
    if (v >= 0 && w >= 0 && v + w <= 1) {
      const q = sub(ap, [ab[0] * v + ac[0] * w, ab[1] * v + ac[1] * w, ab[2] * v + ac[2] * w]);
      return Math.sqrt(dot(q, q));
    }
  }
  return Math.min(segmentDistance(p, a, b), segmentDistance(p, b, c), segmentDistance(p, a, c));
}

/** How far a colour lies from every mix of four colours (the tetrahedron they span). */
function tetrahedronDistance(p: Vec3, corners: readonly [Vec3, Vec3, Vec3, Vec3]): number {
  const [a, b, c, d] = corners;
  const faces: [Vec3, Vec3, Vec3, Vec3][] = [[a, b, c, d], [a, b, d, c], [a, c, d, b], [b, c, d, a]];
  // Inside when p lies on the far corner's side of every face.
  const inside = faces.every(([f0, f1, f2, far]) => {
    const n = cross(sub(f1, f0), sub(f2, f0));
    return dot(n, sub(p, f0)) * dot(n, sub(far, f0)) >= 0;
  });
  return inside ? 0 : Math.min(...faces.map(([f0, f1, f2]) => triangleDistance(p, f0, f1, f2)));
}

/**
 * The share of a monochrome picture's pixels that are no mix of its colours: the look's ink, its
 * other colour (paper, or floor where the paper is ink), and the white and black Stone & shadow's
 * lit lips, highlights and shade lighten and darken towards, so no part has a hue of its own.
 */
export function offMonochrome(canvas: OffscreenCanvas, style: DungeonStyle): number {
  const palette = paletteOf(style, { monochrome: true, shadow: true });
  const corners: [Vec3, Vec3, Vec3, Vec3] = [parseHex(palette.ink), parseHex(palette.paper === palette.ink ? palette.floor : palette.paper), [255, 255, 255], [0, 0, 0]];
  const data = pixels(canvas);
  let off = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (tetrahedronDistance([data[i]!, data[i + 1]!, data[i + 2]!], corners) > MONO_SLACK) off++;
  }
  return off / (data.length / 4);
}

/** How many paths an SVG holds. */
export function pathCount(svg: string): number {
  return svg.match(/<path\b/g)?.length ?? 0;
}
