import type { ShadeHatch } from '../../../lighting/shadeHatch';
import type { DungeonModel } from '../../model';
import type { DungeonStyle, DungeonView } from '../../style';
import { LINE_ANGLE, penSpacing } from '../engraved/pens';
import { mapLayout, mapPixelSize } from '../layoutSize';
import { luminance, paletteOf, parseHex } from '../palette';
import { renderMap } from '../renderMap';
import type { RasterImage } from './reliefImage';

/**
 * Pixels per cell of a floor's shade image. The shade is soft, but it meets what is drawn over it
 * (props, the wall's ink) at their edges: at this size its edge lies within the wall's ink.
 */
export const SHADE_PX_PER_CELL = 48;

/** An Engraved look's cast shadows are fine hatching: the shade averages it over this radius of shade pixels into the wash it reads as. */
const HATCH_BLUR = 1;

function drawn(model: DungeonModel, style: DungeonStyle, view: DungeonView, floor: number, detailAt: number, castShadows: boolean): Uint8ClampedArray {
  const { width, height } = mapPixelSize(model, SHADE_PX_PER_CELL, view);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not draw the shade: no 2D canvas.');
  renderMap(ctx, model, style, view, { pxPerCell: SHADE_PX_PER_CELL, transparent: true, floor, detailAt, castShadows });
  return ctx.getImageData(0, 0, width, height).data;
}

/**
 * Whether a look's cast shadows can lie apart from its map, as a shade multiplied over it: where
 * they darken the floor. A look whose shadows lighten it (Cyanotype's light lines on blue, a dark
 * look in monochrome) keeps them in its map, and its scene gets no shade.
 */
export function shadowsApart(style: DungeonStyle, view: DungeonView): boolean {
  if (!view.shadow) return false;
  const palette = paletteOf(style, view);
  const shadow = style.direction === 'engraved' ? palette.ink : palette.shadow ?? '#000000';
  return luminance(parseHex(shadow)) < luminance(parseHex(palette.floor));
}

/** A floor's shade: the image to multiply over its map, and how an engraving cuts it (`ShadeHatch`). */
export interface FloorShade {
  image: RasterImage;
  hatch: ShadeHatch | null;
}

/**
 * The hatching an Engraved map cuts its shadows in, as the shade's image lies: the map's own lines
 * (`traceHatch`: across the normal of `LINE_ANGLE`, the first through the dungeon's origin), as
 * far apart as the map at `detailAt` pixels a cell draws them.
 */
function hatchOf(model: DungeonModel, style: DungeonStyle, view: DungeonView, detailAt: number): ShadeHatch {
  const { originCell } = mapLayout(model, SHADE_PX_PER_CELL, view);
  const normal = { x: -Math.sin(LINE_ANGLE), y: Math.cos(LINE_ANGLE) };
  return {
    ink: paletteOf(style, view).ink.toLowerCase(),
    spacing: penSpacing(detailAt) * SHADE_PX_PER_CELL,
    angle: LINE_ANGLE,
    offset: (originCell.x * normal.x + originCell.y * normal.y) * SHADE_PX_PER_CELL,
    // The finest line the map at its own size cuts (`pensOf`).
    minWidth: (0.5 / detailAt) * SHADE_PX_PER_CELL,
  };
}

/**
 * The shadows the one light of a floor's map casts, as the map paints them, laid on the map drawn
 * without them (`castShadows: false`): an opaque image to multiply over it, white where nothing
 * falls, the shade's own colour where it does. It is the ratio of the floor drawn with them to the
 * floor drawn without, both at this image's size and with the map's own detail (`detailAt`, its
 * pixels per cell), so whatever is drawn over the shade (props, columns, ink) keeps its own colour.
 * An Engraved look hatches its shadows: their lines average into a wash of the ink's colour, as
 * dark as the hatching is, which the scene cuts as hatching again (`hatch`). Null where the look
 * keeps its shadows in its map (`shadowsApart`), or outside a browser.
 */
export function renderShade(model: DungeonModel, style: DungeonStyle, view: DungeonView, floor: number, detailAt: number): FloorShade | null {
  if (!shadowsApart(style, view) || typeof OffscreenCanvas === 'undefined') return null;
  const { width, height } = mapPixelSize(model, SHADE_PX_PER_CELL, view);
  const lit = drawn(model, style, view, floor, detailAt, true);
  const bare = drawn(model, style, view, floor, detailAt, false);
  const factor = new Float32Array(width * height * 3).fill(1);
  for (let k = 0; k < width * height; k++) {
    const a1 = lit[k * 4 + 3]! / 255;
    const a0 = bare[k * 4 + 3]! / 255;
    if (a0 <= 0) continue;
    for (let c = 0; c < 3; c++) {
      // Premultiplied, half a level added to both: dark ink and their edges read as nothing changed.
      const ratio = (lit[k * 4 + c]! * a1 + 0.5) / (bare[k * 4 + c]! * a0 + 0.5);
      factor[k * 3 + c] = Math.min(1, ratio);
    }
  }
  const engraved = style.direction === 'engraved';
  const soft = engraved ? boxBlur(factor, width, height, HATCH_BLUR) : factor;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let k = 0; k < width * height; k++) {
    data[k * 4] = Math.round(soft[k * 3]! * 255);
    data[k * 4 + 1] = Math.round(soft[k * 3 + 1]! * 255);
    data[k * 4 + 2] = Math.round(soft[k * 3 + 2]! * 255);
    // Where the map holds no art (a hole cut to the floor below, the paper) the shade adds nothing.
    data[k * 4 + 3] = bare[k * 4 + 3]!;
  }
  return { image: { width, height, data }, hatch: engraved ? hatchOf(model, style, view, detailAt) : null };
}

/** Three channels box-blurred over `radius` pixels, twice each way (a tent: the lines' period at this size is about three pixels). */
function boxBlur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  let a = values.slice();
  let b = new Float32Array(a.length);
  const span = radius * 2 + 1;
  for (let pass = 0; pass < 4; pass++) {
    const across = pass % 2 === 0;
    const lines = across ? height : width;
    const length = across ? width : height;
    for (let line = 0; line < lines; line++) {
      const at = (i: number): number => (across ? line * width + i : i * width + line) * 3;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let i = -radius; i <= radius; i++) sum += a[at(Math.min(length - 1, Math.max(0, i))) + c]!;
        for (let i = 0; i < length; i++) {
          b[at(i) + c] = sum / span;
          sum += a[at(Math.min(length - 1, i + radius + 1)) + c]! - a[at(Math.max(0, i - radius)) + c]!;
        }
      }
    }
    [a, b] = [b, a];
  }
  return a;
}
