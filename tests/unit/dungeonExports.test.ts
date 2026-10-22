import { describe, expect, it, vi } from 'vitest';
import { TFolder, type App } from 'obsidian';
import { generateDungeon } from '../../src/app/dungeons/generate';
import { DEFAULT_VIEW, STYLE_PRESETS } from '../../src/app/dungeons/style';
import { dungeonText } from '../../src/app/dungeons/text/dungeonText';
import type { DungeonJob, DungeonRendered } from '../../src/app/dungeons/worker/dungeonJob';
import { saveDungeonExport, type DungeonExportKind } from '../../src/app/packages/components/dungeon-generator/dungeonExports';

const request = { seed: 7, tags: [] };
const model = generateDungeon(request, dungeonText);

/** A vault that holds one folder and records what is written. */
function vault(): { app: App; written: Map<string, string | ArrayBuffer> } {
  const written = new Map<string, string | ArrayBuffer>();
  const folder = new TFolder('atlas-vtt/collections/Dungeons/dungeon-exports');
  const app = {
    vault: {
      getAbstractFileByPath: (path: string) => (path === folder.path ? folder : null),
      getFolderByPath: (path: string) => (path === folder.path ? folder : null),
      createFolder: vi.fn(),
      create: vi.fn(async (path: string, text: string) => { written.set(path, text); }),
      createBinary: vi.fn(async (path: string, bytes: ArrayBuffer) => { written.set(path, bytes); }),
    },
  } as unknown as App;
  return { app, written };
}

async function save(kind: DungeonExportKind, extra: { pxPerCell?: number; transparent?: boolean; arrangement?: number } = {}): Promise<{ job: DungeonJob | undefined; path: string; written: Map<string, string | ArrayBuffer> }> {
  const { app, written } = vault();
  let job: DungeonJob | undefined;
  const render = (asked: DungeonJob): Promise<DungeonRendered> => {
    job = asked;
    const image = asked.output.kind === 'page' && asked.output.svg ? { type: 'svg' as const, svg: '<svg/>' } : { type: 'png' as const, blob: new Blob(['png']) };
    return Promise.resolve({ model, image });
  };
  const path = await saveDungeonExport({ app, render }, kind, { request, model, style: STYLE_PRESETS.parchment, view: DEFAULT_VIEW, collectionId: 'Dungeons', pageAspect: 1.4, ...extra });
  return { job, path, written };
}

describe('saving a dungeon', () => {
  it('saves the page as an SVG document in the arrangement shown', async () => {
    const { job, path, written } = await save('svg', { arrangement: 2 });
    expect(job?.output).toMatchObject({ kind: 'page', svg: true, arrangement: 2 });
    expect(path).toMatch(/\.svg$/);
    expect(written.get(path)).toBe('<svg/>');
  });

  it('saves the map without the paper when asked', async () => {
    expect((await save('map', { pxPerCell: 40, transparent: true })).job?.output).toEqual({ kind: 'map', pxPerCell: 40, numbers: false, transparent: true });
    expect((await save('map', { pxPerCell: 40, transparent: false })).job?.output).toEqual({ kind: 'map', pxPerCell: 40, numbers: false });
  });
});
