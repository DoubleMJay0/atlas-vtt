import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DungeonModel } from '../../../src/app/dungeons/model';
import { mapLayout, suggestedPxPerCell } from '../../../src/app/dungeons/render/layoutSize';
import { createDungeonSceneWith, dungeonSceneName, type DungeonSceneDeps, type DungeonSceneResult } from '../../../src/app/dungeons/scene/createDungeonScene';
import { DEFAULT_VIEW, STYLE_PRESETS } from '../../../src/app/dungeons/style';
import type { DungeonJob, DungeonRendered } from '../../../src/app/dungeons/worker/dungeonJob';
import type { ProcessedImage } from '../../../src/app/imageProcessing/imageProcessing';
import { prebuildMapImageAt } from '../../../src/app/pixi/mapImage/prebuildMapImage';
import { AssetService, type Asset } from '../../../src/app/services/AssetService';
import { AssetThumbnailService } from '../../../src/app/services/AssetThumbnailService';
import type { NotePin } from '../../../src/app/types';
import type { WallSegment } from '../../../src/app/types/wallTypes';
import { smallDungeon } from '../../fixtures/dungeonModels';
import { pngHeader } from '../../fixtures/uvttFiles';
import { createInMemoryApp, interceptWrites, type InMemoryApp } from '../../mocks/inMemoryVault';

vi.mock('../../../src/app/pixi/mapImage/prebuildMapImage', () => ({ prebuildMapImageAt: vi.fn() }));

const COLLECTION = 'Dungeons';
const SCENES = `atlas-vtt/collections/${COLLECTION}/scenes`;
const STYLE = STYLE_PRESETS.parchment;
const TITLE = 'Sunken Vault of the Grey Abbot';

interface Bench {
  vault: InMemoryApp;
  assets: AssetService;
  deps: DungeonSceneDeps;
  jobs: DungeonJob[];
}

/** What the dungeon worker gives back: the model, its layout and a PNG of the layout's size. */
function drawn(job: DungeonJob): DungeonRendered {
  const model = job.model ?? smallDungeon();
  if (job.output.kind !== 'map') throw new Error('Only maps are drawn here');
  const map = mapLayout(model, suggestedPxPerCell(model, job.output.pxPerCell, job.view), job.view);
  return { model, map, image: { type: 'png', blob: new Blob([pngHeader(map.widthPx, map.heightPx)], { type: 'image/png' }) } };
}

const kept = (image: Blob): ProcessedImage => ({ image, thumbnail: new Blob(['THUMB']), preview: null, sourcePreview: null });

async function bench(): Promise<Bench> {
  const vault = createInMemoryApp();
  AssetService.resetInstance();
  const assets = AssetService.getInstance(vault.app);
  await assets.initialize();
  await assets.createCollection(COLLECTION);
  const jobs: DungeonJob[] = [];
  const deps: DungeonSceneDeps = {
    app: vault.app,
    assetService: assets,
    render: async (job) => {
      jobs.push(job);
      return drawn(job);
    },
    convertImage: async (image) => kept(image),
    thumbnails: new AssetThumbnailService(vault.app, assets, async () => new ArrayBuffer(0)),
  };
  return { vault, assets, deps, jobs };
}

const options = (model: DungeonModel = smallDungeon()): Parameters<typeof createDungeonSceneWith>[1] => ({
  request: { seed: model.seed, tags: model.tags },
  model,
  style: STYLE,
  view: DEFAULT_VIEW,
  collectionId: COLLECTION,
});

function created(result: DungeonSceneResult): Extract<DungeonSceneResult, { ok: true }> {
  if (!result.ok) throw new Error(`Refused: ${result.problem}`);
  return result;
}

interface SceneState {
  background: string;
  grid: { size: number; offsetX: number; offsetY: number; autoDetect?: unknown };
  objects: { walls: Record<string, WallSegment>; lights: Record<string, unknown>; pins: Record<string, NotePin> };
  lighting: unknown;
}

const sceneState = ({ vault }: Bench, path: string): SceneState => (JSON.parse(vault.files.get(path)!) as { state: SceneState }).state;
const filesOf = ({ vault }: Bench): string[] => [...vault.files.keys()].sort();
const recordsOf = ({ assets }: Bench): Promise<Asset[]> => assets.getAssets(COLLECTION);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(prebuildMapImageAt).mockClear();
});
afterEach(() => { vi.restoreAllMocks(); AssetService.resetInstance(); });

describe('creating a dungeon scene', () => {
  it('adds a map, a scene with grid, walls, doors, lighting and room pins, and the room key beside it', async () => {
    const b = await bench();

    const result = created(await createDungeonSceneWith(b.deps, options()));

    expect(result).toEqual({ ok: true, name: TITLE, scenePath: `${SCENES}/${TITLE}.atlasmap`, notePath: `${SCENES}/${TITLE}.md` });
    expect(b.jobs[0]!.output).toEqual({ kind: 'map', pxPerCell: 100, numbers: true });
    const records = await recordsOf(b);
    expect(records.map(r => r.type).sort()).toEqual(['map', 'scene']);
    const map = records.find(r => r.type === 'map');
    if (map?.type !== 'map') throw new Error('No map record');
    expect(prebuildMapImageAt).toHaveBeenCalledWith(b.vault.app, map.mapFilePath);

    const state = sceneState(b, result.scenePath);
    expect(state.background).toBe(map.mapFilePath);
    expect(state.grid).toMatchObject({ size: 100, offsetX: 0, offsetY: 0 });
    expect(state.grid.autoDetect).toBeUndefined();
    expect(state.lighting).toEqual({ enabled: true, ambient: 1 });
    expect(state.objects.lights).toEqual({});
    const walls = Object.values(state.objects.walls);
    expect(walls.filter(w => w.type === 'door')).toHaveLength(4);
    expect(walls.filter(w => w.type === 'secret-door')).toHaveLength(1);

    const pins = Object.values(state.objects.pins);
    expect(pins.map(p => p.notePath).sort()).toEqual(['1', '2', '3', '4', '5'].map(ref => `${result.notePath}#${ref}`));
    expect(pins.every(p => p.icon === 'number' && p.gmOnly === true && p.notePath.endsWith(`#${p.label}`))).toBe(true);

    const note = b.vault.files.get(result.notePath)!;
    expect(note).toContain(`# ${TITLE}`);
    for (const ref of ['1', '2', '3', '4', '5']) expect(note).toContain(`\n## ${ref}\n`);
  });

  it('numbers a second dungeon of the same title, scene and note alike', async () => {
    const b = await bench();
    await createDungeonSceneWith(b.deps, options());

    const second = created(await createDungeonSceneWith(b.deps, options()));

    expect(second).toMatchObject({ name: `${TITLE} 2`, notePath: `${SCENES}/${TITLE} 2.md` });
  });

  it('never writes over a note that is already there', async () => {
    const b = await bench();
    await b.vault.app.vault.create(`${SCENES}/${TITLE}.md`, 'Mine');

    const result = created(await createDungeonSceneWith(b.deps, options()));

    expect(b.vault.files.get(`${SCENES}/${TITLE}.md`)).toBe('Mine');
    expect(result.notePath).toBe(`${SCENES}/${TITLE} 2.md`);
  });

  it('fits grid and walls to an image the workers scaled down', async () => {
    const b = await bench();
    b.deps.convertImage = async (image) => {
      const header = new DataView(await image.arrayBuffer());
      const [width, height] = [header.getUint32(16), header.getUint32(20)];
      const to = { width: width / 2, height: height / 2 };
      return { ...kept(new Blob([pngHeader(to.width, to.height)])), scaledDown: { from: { width, height }, to } };
    };

    const result = created(await createDungeonSceneWith(b.deps, options()));

    const state = sceneState(b, result.scenePath);
    expect(state.grid.size).toBe(50);
    const pin = Object.values(state.objects.pins).find(p => p.label === '1')!;
    const hall = smallDungeon().rooms[0]!;
    const { originCell } = mapLayout(smallDungeon(), 100, DEFAULT_VIEW);
    expect(pin.x).toBe((hall.x + hall.w / 2 - originCell.x) * 50);
  });

  it('leaves no file and no record when the note cannot be written', async () => {
    const b = await bench();
    const before = filesOf(b);
    const restore = interceptWrites(b.vault.app.vault, 'create', (path) => {
      if (path.endsWith('.md')) throw new Error('EIO: i/o error');
    });

    const result = await createDungeonSceneWith(b.deps, options());
    restore();

    expect(result).toEqual({ ok: false, problem: 'The map could not be saved. Nothing was added.' });
    expect(filesOf(b)).toEqual(before);
    expect(await recordsOf(b)).toEqual([]);
  });

  it('answers with a problem when the dungeon cannot be drawn', async () => {
    const b = await bench();
    b.deps.render = () => Promise.reject(new Error('Worker crashed'));
    const before = filesOf(b);

    expect(await createDungeonSceneWith(b.deps, options())).toEqual({ ok: false, problem: 'The dungeon could not be saved.' });
    expect(filesOf(b)).toEqual(before);
  });

  it('refuses a collection that is gone', async () => {
    const b = await bench();
    const result = await createDungeonSceneWith(b.deps, { ...options(), collectionId: 'Nowhere' });
    expect(result.ok).toBe(false);
    expect(b.jobs).toEqual([]);
  });

  it('names the scene as a vault file may be called', () => {
    expect(dungeonSceneName('Crypt: of [the] #Lich?')).toBe('Crypt of the Lich');
    expect(dungeonSceneName(' ..  ')).toBe('Dungeon');
  });
});
