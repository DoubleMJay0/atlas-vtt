import { generateDungeon } from '../generate';
import type { DungeonModel, DungeonRequest } from '../model';
import { dungeonFontsReady, type DungeonFontSource } from '../render/fonts';
import { mapPixelSize, suggestedPxPerCell, type MapLayout } from '../render/layoutSize';
import { renderMap } from '../render/renderMap';
import { renderPage, type PageLayout } from '../render/renderPage';
import type { DungeonStyle, DungeonView } from '../style';
import { dungeonText } from '../text/dungeonText';

/**
 * What the dungeon worker does: generate a dungeon (or take one as it is) and draw it on an
 * `OffscreenCanvas`, as the floor plan of a scene or as the one-page layout. Runs in the worker,
 * or in the window where no worker can start.
 */

export type DungeonOutput =
  /** The floor plan, at `pxPerCell` or less where the image would pass a map's limits; a PNG, or a bitmap for a preview. */
  | { kind: 'map'; pxPerCell: number; numbers: boolean; bitmap?: boolean }
  /** The page: title, story, the map and its notes. */
  | { kind: 'page'; width: number; height: number };

export interface DungeonJob {
  request: DungeonRequest;
  /** A dungeon to draw as it is (notes the GM edited or moved); unset generates it from `request`. */
  model?: DungeonModel;
  style: DungeonStyle;
  view: DungeonView;
  output: DungeonOutput;
}

export type RenderedImage = { type: 'png'; blob: Blob } | { type: 'bitmap'; bitmap: ImageBitmap };

export interface DungeonRendered {
  model: DungeonModel;
  image: RenderedImage;
  /** Where a map image lies on the grid (map output). */
  map?: MapLayout;
  /** Where everything landed on a page (page output), for hit-testing. */
  page?: PageLayout;
}

/** What waits until a font can draw: a worker's or a document's font set. */
export interface FontLoader {
  load(font: string): Promise<unknown>;
}

export type DungeonWorkerMessage =
  | { type: 'fonts'; fonts: DungeonFontSource[] }
  | { type: 'render'; id: number; job: DungeonJob };

export type DungeonWorkerReply = { id: number; ok: true; result: DungeonRendered } | { id: number; ok: false; message: string };

function canvasOf(width: number, height: number): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  const canvas = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the dungeon: no 2D canvas.');
  return { canvas, ctx };
}

export async function runDungeonJob(job: DungeonJob, fonts: FontLoader): Promise<DungeonRendered> {
  const { style, view, output } = job;
  const model = job.model ?? generateDungeon(job.request, dungeonText);
  await dungeonFontsReady(fonts, style);
  if (output.kind === 'page') {
    const { canvas, ctx } = canvasOf(Math.round(output.width), Math.round(output.height));
    const page = renderPage(ctx, model, style, view, { width: canvas.width, height: canvas.height });
    return { model, page, image: { type: 'bitmap', bitmap: canvas.transferToImageBitmap() } };
  }
  const pxPerCell = suggestedPxPerCell(model, output.pxPerCell, view);
  // The canvas must have the size of the layout renderMap draws
  const size = mapPixelSize(model, pxPerCell, view);
  const { canvas, ctx } = canvasOf(size.width, size.height);
  const map = renderMap(ctx, model, style, view, { pxPerCell, numbers: output.numbers });
  const image: RenderedImage = output.bitmap
    ? { type: 'bitmap', bitmap: canvas.transferToImageBitmap() }
    : { type: 'png', blob: await canvas.convertToBlob({ type: 'image/png' }) };
  return { model, map, image };
}
