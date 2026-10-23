import type { LiquidColors } from '../../../types/liquidTypes';
import type { DungeonStyle, DungeonView } from '../../style';
import { luminance, mixColours, paletteOf, parseHex } from '../palette';

/** Painted heat always rises from dark crust to light melt, even on light-ink maps. */
export function lavaDuotone(ink: string, floor: string): LiquidColors {
  const lightInk = luminance(parseHex(ink)) > luminance(parseHex(floor));
  const deep = lightInk ? floor : ink;
  const glint = lightInk ? ink : floor;
  return { surface: mixColours(deep, glint, 0.62), deep, glint };
}

/** The same inks as paintMolten, or the warm earth pigments of moltenAt. */
export function lavaPalette(style: DungeonStyle, view: DungeonView): LiquidColors {
  const p = paletteOf(style, view);
  if (style.direction === 'engraved') {
    const ground = view.monochrome ? p.floor : mixColours(p.floor, p.water, 0.5);
    return { surface: ground, deep: p.ink, glint: ground };
  }
  if (view.monochrome) return lavaDuotone(p.ink, p.floor);
  return { surface: '#d66028', deep: '#702414', glint: '#f09646' };
}
