import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapLayout, suggestedPxPerCell } from '../../../src/app/dungeons/render/layoutSize';
import { createDungeonSceneWith, type DungeonSceneDeps } from '../../../src/app/dungeons/scene/createDungeonScene';
import { DEFAULT_VIEW } from '../../../src/app/dungeons/style';
import { dungeonStyle } from '../../../src/app/dungeons/styleCatalog';
import type { DungeonJob, DungeonRendered } from '../../../src/app/dungeons/worker/dungeonJob';
import { AssetService, type SceneAsset } from '../../../src/app/services/AssetService';
import { AssetThumbnailService } from '../../../src/app/services/AssetThumbnailService';
import { smallDungeon } from '../../fixtures/dungeonModels';
import { fakeBitmap, pngOfBitmap } from '../../fixtures/uvttFiles';
import { createInMemoryApp, type InMemoryApp } from '../../mocks/inMemoryVault';

vi.mock('../../../src/app/pixi/mapImage/prebuildMapImage', () => ({ prebuildMapImageAt: vi.fn() }));

const COLLECTION = 'Dungeons';
const NOTE = 'Notes/Campaign secrets.md';

function drawn(job: DungeonJob): DungeonRendered {
  const model = job.model ?? smallDungeon();
  if (job.output.kind !== 'map' && job.output.kind !== 'shading') throw new Error('Only maps and their shading are drawn here');
  const map = mapLayout(model, suggestedPxPerCell(model, job.output.pxPerCell, job.view, job.output.maxPixels), job.view);
  if (job.output.kind === 'shading') return { model, map, image: { type: 'shading', relief: new Blob(['RELIEF']), shade: new Blob(['SHADE']) } };
  return { model, map, image: { type: 'bitmap', bitmap: fakeBitmap(map.widthPx, map.heightPx) } };
}

interface Bench { vault: InMemoryApp; assets: AssetService; deps: DungeonSceneDeps }

async function bench(): Promise<Bench> {
  const vault = createInMemoryApp({ files: { [NOTE]: 'secret' } });
  AssetService.resetInstance();
  const assets = AssetService.getInstance(vault.app);
  await assets.initialize();
  await assets.createCollection(COLLECTION);
  const deps: DungeonSceneDeps = {
    app: vault.app,
    assetService: assets,
    render: async (job) => drawn(job),
    convertImage: async (image) => ({ image: pngOfBitmap(image), thumbnail: new Blob(['THUMB']), preview: null, sourcePreview: null }),
    thumbnails: new AssetThumbnailService(vault.app, assets, async () => new ArrayBuffer(0)),
  };
  return { vault, assets, deps };
}

/** A dungeon scene written as the generator writes one: its record, and its file's state. */
async function scene(b: Bench, name: string): Promise<{ record: SceneAsset; path: string; state: { relief: string; shade: string } }> {
  const model = smallDungeon();
  const result = await createDungeonSceneWith(b.deps, { name, request: { seed: model.seed, tags: model.tags, floors: 1 }, model, style: dungeonStyle('parchment'), view: DEFAULT_VIEW, collectionId: COLLECTION });
  if (!result.ok) throw new Error(result.problem);
  const record = (await b.assets.getAssets(COLLECTION)).find((asset): asset is SceneAsset => asset.type === 'scene' && asset.data?.mapPath === result.scenePath)!;
  const { state } = JSON.parse(b.vault.files.get(result.scenePath)!) as { state: { relief: string; shade: string } };
  return { record, path: result.scenePath, state };
}

/** Rewrites what a scene's file names, as a hand edit or a stranger's bundle might. */
function renames(b: Bench, path: string, changes: Record<string, unknown>): void {
  const file = JSON.parse(b.vault.files.get(path)!) as { state: Record<string, unknown> };
  b.vault.files.set(path, JSON.stringify({ ...file, state: { ...file.state, ...changes } }));
}

afterEach(() => { vi.restoreAllMocks(); AssetService.resetInstance(); });

describe('deleting a scene with a relief and a shade', () => {
  it('trashes the relief and shade its writer made for it', async () => {
    const b = await bench();
    const { record, state } = await scene(b, 'Crypt');
    expect(record.shadingFiles?.sort()).toEqual([state.relief, state.shade].sort());

    await b.assets.deleteAsset(record.id);

    expect(b.vault.files.has(state.relief)).toBe(false);
    expect(b.vault.files.has(state.shade)).toBe(false);
  });

  it('leaves a note its file names as its relief, whatever the file says', async () => {
    const b = await bench();
    const { record, path, state } = await scene(b, 'Crypt');
    renames(b, path, { relief: NOTE, shade: 'Notes/Campaign secrets.png' });
    await b.vault.app.vault.create('Notes/Campaign secrets.png', 'a picture of mine');

    await b.assets.deleteAsset(record.id);

    expect(b.vault.files.get(NOTE)).toBe('secret');
    expect(b.vault.files.get('Notes/Campaign secrets.png')).toBe('a picture of mine');
    // What the scene's file no longer names stays as well: only a path both name goes.
    expect(b.vault.files.has(state.relief)).toBe(true);
  });

  it('keeps a relief another scene names too', async () => {
    const b = await bench();
    const first = await scene(b, 'Crypt');
    const second = await scene(b, 'Vault');
    renames(b, second.path, { relief: first.state.relief });

    await b.assets.deleteAsset(first.record.id);

    expect(b.vault.files.has(first.state.relief)).toBe(true);
    expect(b.vault.files.has(first.state.shade)).toBe(false);
  });

  it('keeps a relief a copy names whose data is not loaded, as a copy made outside Atlas may be', async () => {
    const b = await bench();
    const first = await scene(b, 'Crypt');
    const second = await scene(b, 'Vault');
    renames(b, second.path, { relief: first.state.relief });
    // The copy's record without its loaded data: its map is found through its record's JSON.
    delete (b.assets as unknown as { metadata: { assets: Record<string, { data?: unknown }> } }).metadata.assets[second.record.id]!.data;

    await b.assets.deleteAsset(first.record.id);

    expect(b.vault.files.has(first.state.relief)).toBe(true);
  });

  it('deletes a collection of dungeon scenes with every image they own', async () => {
    const b = await bench();
    const scenes = [await scene(b, 'Crypt'), await scene(b, 'Vault'), await scene(b, 'Barrow')];
    await b.assets.createCollection('Spare');

    await b.assets.deleteCollection(COLLECTION);

    for (const { state } of scenes) {
      expect(b.vault.files.has(state.relief)).toBe(false);
      expect(b.vault.files.has(state.shade)).toBe(false);
    }
  });

  it('keeps an image another asset uses, though the scene\'s record lists it', async () => {
    const b = await bench();
    const { record, path, state } = await scene(b, 'Crypt');
    const maps = (await b.assets.getAssets(COLLECTION)).filter((asset) => asset.type === 'map');
    const mapImage = maps[0]!.type === 'map' ? maps[0]!.mapFilePath : '';
    renames(b, path, { relief: mapImage });
    await b.assets.updateAsset(record.id, { shadingFiles: [...(record.shadingFiles ?? []), mapImage] } as Partial<SceneAsset>);

    await b.assets.deleteAsset(record.id);

    expect(b.vault.files.has(mapImage)).toBe(true);
    expect(b.vault.files.has(state.shade)).toBe(false);
  });
});
