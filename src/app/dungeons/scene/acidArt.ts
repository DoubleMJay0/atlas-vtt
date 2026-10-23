import type { LiquidColors } from '../../types/liquidTypes';
import { mixColours, paletteOf } from '../render/palette';
import { stoneColours } from '../render/stone/colours';
import type { DungeonStyle, DungeonView } from '../style';

/** Acid borrows the actual drawing's pigments, including reversed ink on Cyanotype. */
export function acidColours(style: DungeonStyle, view: DungeonView): LiquidColors {
  const palette = paletteOf(style, view);
  if (style.direction === 'engraved') {
    return { surface: view.monochrome ? palette.floor : mixColours(palette.floor, palette.water, 0.5), deep: palette.ink, glint: palette.ink };
  }
  const stone = stoneColours(palette, view.monochrome);
  if (view.monochrome) {
    return { surface: stone.water, deep: mixColours(palette.floor, palette.ink, 0.5), glint: mixColours(palette.floor, palette.ink, stone.dark ? 0.55 : 0.4) };
  }
  // The painter's acid ramp (lavaField) and pale bubble rims (stone/acid), subdued on dark floors.
  return { surface: '#80b034', deep: '#344a1a', glint: mixColours('#d6f08c', '#80b034', stone.dark ? 0.45 : 0.2) };
}
