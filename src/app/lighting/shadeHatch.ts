import { isRecord } from '../utils/guards';

/**
 * How a shade image is drawn where its map is an engraving (`ShadeLayer`): not as the wash it
 * holds, but cut as the map's own hatching, lines of `ink` `spacing` shade pixels apart at `angle`
 * (radians on screen), each as wide as the wash is deep, the first through the shade pixel whose
 * distance across the lines plus `offset` is a whole number of spacings; a line narrower than
 * `minWidth` shade pixels is not cut, as the map cuts none. A shade image carries it
 * in a PNG text chunk (`SHADE_HATCH_KEY`), so it travels wherever the image goes.
 */
export interface ShadeHatch {
  ink: string;
  spacing: number;
  angle: number;
  offset: number;
  minWidth: number;
}

export const SHADE_HATCH_KEY = 'atlas-shade-hatch';

/** A shade image's hatching as its text chunk says it; null where it says none, or nothing Atlas can draw. */
export function readShadeHatch(text: string | null): ShadeHatch | null {
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { ink, spacing, angle, offset, minWidth } = value;
  if (typeof ink !== 'string' || !/^#[0-9a-f]{6}$/i.test(ink)) return null;
  if (typeof spacing !== 'number' || !Number.isFinite(spacing) || spacing < 0.5 || spacing > 512) return null;
  if (typeof angle !== 'number' || !Number.isFinite(angle) || typeof offset !== 'number' || !Number.isFinite(offset)) return null;
  const narrowest = typeof minWidth === 'number' && Number.isFinite(minWidth) && minWidth >= 0 ? Math.min(minWidth, spacing) : 0;
  return { ink: ink.toLowerCase(), spacing, angle, offset, minWidth: narrowest };
}

/** The text chunk that says `hatch`. */
export function shadeHatchText(hatch: ShadeHatch): string {
  return JSON.stringify(hatch);
}
