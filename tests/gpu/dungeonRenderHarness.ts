import { commands } from 'vitest/browser';
import germaniaUrl from '../../src/app/assets/fonts/germania-one.ttf?url';
import pathwayUrl from '../../src/app/assets/fonts/pathway-gothic-one.ttf?url';
import { DUNGEON_FONT_FAMILIES, installDungeonFonts } from '../../src/app/dungeons/render/fonts';

/** Where rendered pictures go, under the project root (the browser may write nowhere else). */
export const RENDER_OUT = 'out/dungeon-render';

/** Loads the bundled faces as a worker would: from their sources into a font set. */
export async function loadDungeonFonts(): Promise<void> {
  await installDungeonFonts(document.fonts, [
    { family: DUNGEON_FONT_FAMILIES.title, source: `url("${germaniaUrl}")` },
    { family: DUNGEON_FONT_FAMILIES.text, source: `url("${pathwayUrl}")` },
  ]);
}

export async function savePng(canvas: OffscreenCanvas, name: string): Promise<void> {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  await commands.writeFile(`${RENDER_OUT}/${name}.png`, btoa(binary), 'base64');
}

export interface PixelStats {
  /** Share of pixels close to the ink colour. */
  ink: number;
  /** Distinct colours, coarsely binned. */
  colours: number;
  transparent: number;
}

export function pixelStats(canvas: OffscreenCanvas, ink: [number, number, number]): PixelStats {
  const ctx = canvas.getContext('2d')!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let inkCount = 0;
  let transparent = 0;
  const bins = new Set<number>();
  const total = data.length / 4;
  const stride = Math.max(1, Math.floor(total / 400_000));
  let sampled = 0;
  for (let i = 0; i < total; i += stride) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const a = data[i * 4 + 3]!;
    sampled++;
    if (a < 8) transparent++;
    if (Math.abs(r - ink[0]) + Math.abs(g - ink[1]) + Math.abs(b - ink[2]) < 60 && a > 200) inkCount++;
    bins.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
  }
  return { ink: inkCount / sampled, colours: bins.size, transparent: transparent / sampled };
}
