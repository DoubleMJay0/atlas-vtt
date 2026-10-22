import type { DungeonModel } from '../model';
import type { DungeonStyle, DungeonView } from '../style';
import { DUNGEON_FONT_FAMILIES, type DungeonFontSource } from './fonts';
import type { Canvas2D } from './geometry';
import { renderPage, type PageLayout, type PageSize } from './renderPage';
import { SvgCanvas } from './svgCanvas';

/**
 * The page as an SVG document: drawn by the same renderer as the PNG, into a context that writes
 * SVG, with the bundled faces it uses embedded, so the file shows the same page anywhere.
 */
export function renderPageSvg(model: DungeonModel, style: DungeonStyle, view: DungeonView, size: PageSize, fonts: readonly DungeonFontSource[]): { svg: string; page: PageLayout } {
  const measure = new OffscreenCanvas(1, 1).getContext('2d');
  if (!measure) throw new Error('Could not measure the dungeon\'s text: no 2D canvas.');
  const svg = new SvgCanvas(size.width, size.height, measure);
  // The recorder offers every part of the 2D context the renderer uses.
  const page = renderPage(svg as unknown as Canvas2D, model, style, view, size);
  return { svg: svg.toSvg(fontFaces(style, fonts)), page };
}

/** @font-face rules for the bundled faces `style` uses, each with its font file inside. */
function fontFaces(style: DungeonStyle, fonts: readonly DungeonFontSource[]): string {
  const used = new Set(Object.values(style.fonts).map(font => font.face));
  const wanted = new Set<string>([used.has('title') ? DUNGEON_FONT_FAMILIES.title : '', used.has('text') ? DUNGEON_FONT_FAMILIES.text : ''].filter(Boolean));
  return fonts
    .filter(font => wanted.has(font.family))
    .map(({ family, source }) => {
      const src = embedded(source);
      return src ? `@font-face{font-family:"${family}";src:${src};}` : '';
    })
    .join('');
}

const URL_OF = /url\(\s*(["']?)(.*?)\1\s*\)/;

/**
 * A face's source when its file is inside it, as the plugin's stylesheet inlines every bundled
 * face; null otherwise (an SVG shown elsewhere could not reach a file the page points at).
 */
function embedded(source: string): string | null {
  const url = URL_OF.exec(source)?.[2];
  return url?.startsWith('data:') ? `url("${url}")` : null;
}
