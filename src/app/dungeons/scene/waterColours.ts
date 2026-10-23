import type { LiquidColors } from '../../types/liquidTypes';
import { mixColours, paletteOf } from '../render/palette';
import { stoneColours } from '../render/stone/colours';
import type { DungeonStyle, DungeonView } from '../style';

/** The pigments the static water painters use, also for the water's moving marks. */
export function waterColours(style: DungeonStyle, view: DungeonView): LiquidColors {
  const palette = paletteOf(style, view);
  if (style.direction === 'engraved') {
    const paper = view.monochrome ? palette.floor : mixColours(palette.floor, palette.water, 0.5);
    // Ink can be pale (Cyanotype): do not treat it as a darkening colour or add white light.
    return { surface: paper, deep: palette.ink, glint: paper };
  }
  const c = stoneColours(palette, view.monochrome);
  return {
    surface: c.water,
    deep: view.monochrome ? (c.dark ? palette.floor : c.line) : mixColours(c.water, c.dark ? '#000000' : c.line, 0.42),
    glint: view.monochrome ? (c.dark ? c.line : palette.floor) : mixColours(c.water, c.light, c.dark ? 0.28 : 0.5),
  };
}
