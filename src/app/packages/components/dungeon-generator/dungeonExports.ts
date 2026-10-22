import type { App } from 'obsidian';
import type { DungeonModel, DungeonRequest } from '../../../dungeons/model';
import { dungeonSceneName } from '../../../dungeons/scene/createDungeonScene';
import { dungeonNoteText } from '../../../dungeons/scene/dungeonNote';
import type { DungeonStyle, DungeonView } from '../../../dungeons/style';
import { paletteFileText } from '../../../dungeons/styleJson';
import type { DungeonJob, DungeonRendered } from '../../../dungeons/worker/dungeonJob';
import { ensureFolder, isPathTaken } from '../../../plugin/vaultFolders';
import { collectionFolderPath } from '../../../services/assetPaths';
import { freePathIn } from '../../../services/collectionBundle/pathRemap';

/**
 * Saving a dungeon as files: the page as PNG or SVG, the floor plan as PNG, the model as JSON, the key as
 * Markdown, the style as a palette. Every file goes into the collection's `dungeon-exports`
 * folder, which no tab of the asset manager reads, so nothing saved there becomes an asset.
 */

export type DungeonExportKind = 'page' | 'svg' | 'map' | 'json' | 'markdown' | 'palette';

export const DUNGEON_EXPORTS_FOLDER = 'dungeon-exports';

/** The longest side of a page saved as PNG. */
const PAGE_EXPORT_SIDE = 3200;
/** The longest side of a page saved as SVG, the size the page's text and lines are laid out for. */
const PAGE_SVG_SIDE = 1400;

export interface DungeonExportInput {
  request: DungeonRequest;
  /** The dungeon as shown, with the GM's edits. */
  model: DungeonModel;
  style: DungeonStyle;
  view: DungeonView;
  collectionId: string;
  /** The shape of the preview, which a saved page keeps. */
  pageAspect: number;
  /** Which automatic arrangement the page's note boxes take, as in the preview. */
  arrangement?: number;
  /** Map PNG only. */
  pxPerCell?: number;
  /** Map PNG only: without the paper, as the one-page generator saves its maps. */
  transparent?: boolean;
}

export interface DungeonExportDeps {
  app: App;
  render: (job: DungeonJob) => Promise<DungeonRendered>;
}

/** A page of the preview's shape whose longest side is `side`. */
export function pageExportSize(aspect: number, side = PAGE_EXPORT_SIDE): { width: number; height: number } {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1.4;
  return ratio >= 1 ? { width: side, height: Math.round(side / ratio) } : { width: Math.round(side * ratio), height: side };
}

async function pngOf(rendered: DungeonRendered): Promise<Blob> {
  const { image } = rendered;
  if (image.type === 'png') return image.blob;
  if (image.type === 'svg') throw new Error('An SVG page is no PNG.');
  const canvas = new OffscreenCanvas(image.bitmap.width, image.bitmap.height);
  canvas.getContext('2d')?.drawImage(image.bitmap, 0, 0);
  image.bitmap.close();
  return canvas.convertToBlob({ type: 'image/png' });
}

async function contentOf(deps: DungeonExportDeps, kind: DungeonExportKind, input: DungeonExportInput): Promise<string | Blob> {
  const { request, model, style, view } = input;
  switch (kind) {
    case 'page': {
      const size = pageExportSize(input.pageAspect);
      return pngOf(await deps.render({ request, model, style, view, output: { kind: 'page', ...size, ...(input.arrangement ? { arrangement: input.arrangement } : {}) } }));
    }
    case 'svg': {
      const size = pageExportSize(input.pageAspect, PAGE_SVG_SIDE);
      const { image } = await deps.render({ request, model, style, view, output: { kind: 'page', ...size, svg: true, ...(input.arrangement ? { arrangement: input.arrangement } : {}) } });
      if (image.type !== 'svg') throw new Error('The page was not drawn as SVG.');
      return image.svg;
    }
    case 'map':
      return pngOf(await deps.render({
        request,
        model,
        style,
        view,
        output: { kind: 'map', pxPerCell: input.pxPerCell ?? 70, numbers: false, ...(input.transparent ? { transparent: true } : {}) },
      }));
    case 'json':
      return `${JSON.stringify(model, null, 2)}\n`;
    case 'markdown':
      return dungeonNoteText(model, view);
    case 'palette':
      return paletteFileText(style);
  }
}

function fileNameOf(kind: DungeonExportKind, input: DungeonExportInput): string {
  const base = dungeonSceneName(input.model.title);
  switch (kind) {
    case 'page': return `${base}.png`;
    case 'svg': return `${base}.svg`;
    case 'map': return `${base} map.png`;
    case 'json': return `${base}.json`;
    case 'markdown': return `${base}.md`;
    case 'palette': return `Palette ${input.style.colors.ink.slice(1)}-${input.style.colors.paper.slice(1)}.json`;
  }
}

/** Saves one export and returns its vault path. Throws where drawing or writing failed. */
export async function saveDungeonExport(deps: DungeonExportDeps, kind: DungeonExportKind, input: DungeonExportInput): Promise<string> {
  const { app } = deps;
  const content = await contentOf(deps, kind, input);
  const folder = await ensureFolder(app, `${collectionFolderPath(input.collectionId)}/${DUNGEON_EXPORTS_FOLDER}`);
  const path = freePathIn(folder.path, fileNameOf(kind, input), (candidate) => isPathTaken(app, candidate));
  if (typeof content === 'string') await app.vault.create(path, content);
  else await app.vault.createBinary(path, await content.arrayBuffer());
  return path;
}
