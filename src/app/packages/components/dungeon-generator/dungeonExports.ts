import type { App } from 'obsidian';
import type { DungeonModel, DungeonRequest } from '../../../dungeons/model';
import { dungeonSceneName } from '../../../dungeons/scene/createDungeonScene';
import type { DungeonStyle, DungeonView } from '../../../dungeons/style';
import { paletteFileText } from '../../../dungeons/styleJson';
import type { DungeonJob, DungeonRendered } from '../../../dungeons/worker/dungeonJob';
import { ensureFolder, isPathTaken } from '../../../plugin/vaultFolders';
import { collectionFolderPath } from '../../../services/assetPaths';
import { freePathIn } from '../../../services/collectionBundle/pathRemap';

/**
 * Saving a dungeon as files: the map as PNG or SVG, the model as JSON, the style as a palette.
 * Every file goes into the collection's `dungeon-exports` folder, which no tab of the asset
 * manager reads, so nothing saved there becomes an asset.
 */

export type DungeonExportKind = 'map' | 'svg' | 'json' | 'palette';

const DUNGEON_EXPORTS_FOLDER = 'dungeon-exports';

/** The cell an SVG map is laid out at: the size its strokes are given for. */
const SVG_PX_PER_CELL = 30;

export interface DungeonExportInput {
  request: DungeonRequest;
  /** The dungeon as shown, with the GM's edits. */
  model: DungeonModel;
  /** The name the GM gave it, which names the files; unset or empty falls back to "Dungeon". */
  name?: string;
  style: DungeonStyle;
  view: DungeonView;
  collectionId: string;
  /** Map PNG only. */
  pxPerCell?: number;
  /** Map PNG only: without the paper, for a map laid over other art. */
  transparent?: boolean;
}

export interface DungeonExportDeps {
  app: App;
  render: (job: DungeonJob) => Promise<DungeonRendered>;
}

async function pngOf(rendered: DungeonRendered): Promise<Blob> {
  const { image } = rendered;
  if (image.type === 'png') return image.blob;
  if (image.type === 'svg') throw new Error('An SVG map is no PNG.');
  const canvas = new OffscreenCanvas(image.bitmap.width, image.bitmap.height);
  canvas.getContext('2d')?.drawImage(image.bitmap, 0, 0);
  image.bitmap.close();
  return canvas.convertToBlob({ type: 'image/png' });
}

async function contentOf(deps: DungeonExportDeps, kind: DungeonExportKind, input: DungeonExportInput): Promise<string | Blob> {
  const { request, model, style, view } = input;
  switch (kind) {
    case 'map':
      return pngOf(await deps.render({
        request,
        model,
        style,
        view,
        output: { kind: 'map', pxPerCell: input.pxPerCell ?? 70, ...(input.transparent ? { transparent: true } : {}) },
      }));
    case 'svg': {
      const { image } = await deps.render({ request, model, style, view, output: { kind: 'map', pxPerCell: SVG_PX_PER_CELL, svg: true } });
      if (image.type !== 'svg') throw new Error('The map was not drawn as SVG.');
      return image.svg;
    }
    case 'json':
      return `${JSON.stringify(model, null, 2)}\n`;
    case 'palette':
      return paletteFileText(style);
  }
}

function fileNameOf(kind: DungeonExportKind, input: DungeonExportInput): string {
  const base = dungeonSceneName(input.name ?? '');
  switch (kind) {
    case 'map': return `${base}.png`;
    case 'svg': return `${base}.svg`;
    case 'json': return `${base}.json`;
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
