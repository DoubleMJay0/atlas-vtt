import type { DungeonStyle, FontStyle } from '../style';

/**
 * The dungeon's typefaces. The two bundled faces are declared with @font-face in main.scss (the
 * only place a font may live, for its licence notice), so the window has them. A worker has no
 * stylesheet: the window reads each face's source out of the stylesheet (`readDungeonFonts`)
 * and hands it over, and the worker adds it to its own font set (`installDungeonFonts`).
 */

export const DUNGEON_FONT_FAMILIES = {
  title: 'Atlas Germania One',
  text: 'Atlas Pathway Gothic One',
} as const;

const STACKS: Record<FontStyle['face'], string> = {
  title: `"${DUNGEON_FONT_FAMILIES.title}", "Germania One", Georgia, serif`,
  text: `"${DUNGEON_FONT_FAMILIES.text}", "Pathway Gothic One", "Arial Narrow", sans-serif`,
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

/** A CSS font for a canvas, `px` pixels high. */
export function cssFont(font: FontStyle, px: number): string {
  return `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${Math.max(1, px).toFixed(2)}px ${STACKS[font.face]}`;
}

/** A bundled face as a FontFace source: its family and its `url(...)` from the stylesheet. */
export interface DungeonFontSource {
  family: string;
  source: string;
}

const FONT_URL = /url\(\s*(["']?)(.*?)\1\s*\)/;

/** Finds the bundled faces' sources in a document's stylesheets (the window's side). */
export function readDungeonFonts(doc: Document): DungeonFontSource[] {
  const wanted = new Set<string>(Object.values(DUNGEON_FONT_FAMILIES));
  const found = new Map<string, DungeonFontSource>();
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!rule.cssText.startsWith('@font-face')) continue;
      const style = (rule as CSSFontFaceRule).style;
      const family = style.getPropertyValue('font-family').trim().replace(/^["']|["']$/g, '');
      const src = FONT_URL.exec(style.getPropertyValue('src'));
      if (wanted.has(family) && src && !found.has(family)) found.set(family, { family, source: `url("${src[2]}")` });
    }
  }
  return [...found.values()];
}

/** The font set of a window or a worker. */
export interface FontSetLike {
  add(font: FontFace): unknown;
  check(font: string): boolean;
}

/**
 * Adds the bundled faces to a font set (a worker's `self.fonts`, or a document's) and waits until
 * they can draw. Faces already there are left alone.
 */
export async function installDungeonFonts(fonts: FontSetLike, sources: readonly DungeonFontSource[]): Promise<void> {
  await Promise.all(
    sources.map(async ({ family, source }) => {
      if (fonts.check(`12px "${family}"`) && hasFace(fonts, family)) return;
      const face = new FontFace(family, source, { style: 'normal', weight: '400' });
      await face.load();
      fonts.add(face);
    }),
  );
}

function hasFace(fonts: FontSetLike, family: string): boolean {
  const iterable = fonts as unknown as Iterable<FontFace>;
  if (typeof iterable[Symbol.iterator] !== 'function') return false;
  for (const face of iterable) if (face.family.replace(/["']/g, '') === family) return true;
  return false;
}

/** Waits until every face a style uses has loaded in a font set that holds them. */
export async function dungeonFontsReady(fonts: { load(font: string): Promise<unknown> }, style: DungeonStyle): Promise<void> {
  await Promise.all(Object.values(style.fonts).map(font => fonts.load(cssFont(font, 16)).catch(() => undefined)));
}
