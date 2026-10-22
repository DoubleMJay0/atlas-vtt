import { beforeAll, describe, expect, it } from 'vitest';
import germaniaUrl from '../../src/app/assets/fonts/germania-one.ttf?url';
import pathwayUrl from '../../src/app/assets/fonts/pathway-gothic-one.ttf?url';
import { generateDungeon } from '../../src/app/dungeons/generate';
import { DUNGEON_FONT_FAMILIES, type DungeonFontSource } from '../../src/app/dungeons/render/fonts';
import { renderPage } from '../../src/app/dungeons/render/renderPage';
import { renderPageSvg } from '../../src/app/dungeons/render/svgPage';
import { DEFAULT_VIEW, STYLE_PRESETS, type StylePresetId } from '../../src/app/dungeons/style';
import { dungeonText } from '../../src/app/dungeons/text/dungeonText';
import { loadDungeonFonts, savePng } from './dungeonRenderHarness';

/**
 * The page saved as SVG against the page drawn on a canvas: the SVG, shown by the browser with
 * the faces it embeds, must be the same picture but for the edges antialiasing draws apart.
 */

const SIZE = { width: 1400, height: 1000 };

/** A face as the plugin's stylesheet holds it: its file inlined as a data URL. */
async function inlined(family: string, url: string): Promise<DungeonFontSource> {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { family, source: `url("data:font/ttf;base64,${btoa(binary)}")` };
}

let SOURCES: DungeonFontSource[] = [];

async function rasterise(svg: string): Promise<OffscreenCanvas> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = new OffscreenCanvas(SIZE.width, SIZE.height);
    canvas.getContext('2d')!.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The share of pixels whose colours differ by more than a faint edge would, and a picture of where. */
function difference(a: OffscreenCanvas, b: OffscreenCanvas): { share: number; picture: OffscreenCanvas } {
  const da = a.getContext('2d')!.getImageData(0, 0, SIZE.width, SIZE.height).data;
  const db = b.getContext('2d')!.getImageData(0, 0, SIZE.width, SIZE.height).data;
  const picture = new OffscreenCanvas(SIZE.width, SIZE.height);
  const out = picture.getContext('2d')!.createImageData(SIZE.width, SIZE.height);
  let differ = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.abs(da[i]! - db[i]!) + Math.abs(da[i + 1]! - db[i + 1]!) + Math.abs(da[i + 2]! - db[i + 2]!);
    const off = d > 96;
    if (off) differ++;
    out.data[i] = off ? 255 : da[i]! / 2 + 100;
    out.data[i + 1] = off ? 0 : da[i + 1]! / 2 + 100;
    out.data[i + 2] = off ? 0 : da[i + 2]! / 2 + 100;
    out.data[i + 3] = 255;
  }
  picture.getContext('2d')!.putImageData(out, 0, 0);
  return { share: differ / (da.length / 4), picture };
}

const CASES: readonly { name: string; seed: number; tags: string[]; preset: StylePresetId }[] = [
  { name: 'default', seed: 458782179, tags: [], preset: 'parchment' },
  { name: 'round', seed: 404, tags: ['round', 'colonnades', 'temple'], preset: 'masonry' },
  { name: 'flooded', seed: 2024, tags: ['flooded', 'tomb', 'winding'], preset: 'slate' },
  { name: 'secret', seed: 515, tags: ['secret'], preset: 'drafting' },
  { name: 'crumbling', seed: 202, tags: ['crumbling', 'dangerous'], preset: 'stipple' },
];

describe('the page as SVG', () => {
  beforeAll(async () => {
    await loadDungeonFonts();
    SOURCES = await Promise.all([inlined(DUNGEON_FONT_FAMILIES.title, germaniaUrl), inlined(DUNGEON_FONT_FAMILIES.text, pathwayUrl)]);
  });

  for (const { name, seed, tags, preset } of CASES) {
    it(`draws the ${name} page in ${preset} as the canvas does`, async () => {
      const model = generateDungeon({ seed, tags }, dungeonText);
      const style = STYLE_PRESETS[preset];
      const canvas = new OffscreenCanvas(SIZE.width, SIZE.height);
      const drawn = renderPage(canvas.getContext('2d')!, model, style, DEFAULT_VIEW, SIZE);
      const { svg, page } = renderPageSvg(model, style, DEFAULT_VIEW, SIZE, SOURCES);

      expect(page).toEqual(drawn);
      const bundled = Object.values(style.fonts).some((font) => font.face === 'title' || font.face === 'text');
      expect(svg.includes('@font-face')).toBe(bundled);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      const { share, picture } = difference(canvas, await rasterise(svg));
      await savePng(picture, `svg-diff-${name}-${preset}`);
      expect(share).toBeLessThan(0.01);
    });
  }
});
