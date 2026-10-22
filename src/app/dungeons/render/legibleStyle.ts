import type { DungeonStyle } from '../style';

/**
 * Page pixels per cell (on the 1400 × 1000 page sizes are given for) below which a drawn map
 * keeps its hatching and strokes from shrinking with it: a large dungeon fitted to a page would
 * otherwise wear its hatching as a fringe of hairlines.
 */
const LEGIBLE_CELL_PX = 24;

/**
 * The style a map is drawn in at `cellPx` page pixels per cell: below the legible size the
 * surroundings grow by (legible / cellPx)^0.75 and the strokes by its square root, so both shrink
 * more slowly than the map but still with it.
 */
export function legibleStyle(style: DungeonStyle, cellPx: number): DungeonStyle {
  if (!(cellPx > 0) || cellPx >= LEGIBLE_CELL_PX) return style;
  const ratio = LEGIBLE_CELL_PX / cellPx;
  const grow = ratio ** 0.75;
  const thicken = Math.sqrt(ratio);
  const { strokes, hatching } = style;
  return {
    ...style,
    strokes: { thin: strokes.thin * thicken, hatching: strokes.hatching * thicken, normal: strokes.normal * thicken, thick: strokes.thick * thicken },
    hatching: { ...hatching, size: hatching.size * grow, distance: hatching.distance * grow },
  };
}
