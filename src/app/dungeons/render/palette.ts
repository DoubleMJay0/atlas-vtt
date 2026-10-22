import type { DungeonStyle, DungeonView } from '../style';

/** The colours a drawing uses, after Monochrome and the Shadow layer have had their say. */
export interface Palette {
  ink: string;
  shading: string;
  water: string;
  floor: string;
  paper: string;
  /** Null when no inner shadow is drawn. */
  shadow: string | null;
}

type Rgb = [number, number, number];

export function parseHex(colour: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(colour.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A colour with an alpha, as CSS. */
export function withAlpha(colour: string, alpha: number): string {
  const [r, g, b] = parseHex(colour);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pure white switches the shadow off, as it would multiply to nothing. */
function isWhite(colour: string): boolean {
  const [r, g, b] = parseHex(colour);
  return r === 255 && g === 255 && b === 255;
}

export function paletteOf(style: DungeonStyle, view: Pick<DungeonView, 'monochrome' | 'shadow'>): Palette {
  const { ink, paper } = style.colors;
  if (view.monochrome) {
    const inkL = luminance(parseHex(ink));
    const paperL = luminance(parseHex(paper));
    const snap = (colour: string): string => {
      const l = luminance(parseHex(colour));
      return Math.abs(l - inkL) <= Math.abs(l - paperL) ? ink : paper;
    };
    return { ink, paper, shading: snap(style.colors.shading), water: snap(style.colors.water), floor: snap(style.colors.floor), shadow: null };
  }
  const shadow = view.shadow && !isWhite(style.shadow.color) ? style.shadow.color : null;
  return { ...style.colors, shadow };
}
