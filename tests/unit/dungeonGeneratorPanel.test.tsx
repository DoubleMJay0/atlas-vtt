// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { generateDungeon } from '../../src/app/dungeons/generate';
import type { DungeonRequest } from '../../src/app/dungeons/model';
import { createDungeonScene } from '../../src/app/dungeons/scene/createDungeonScene';
import { dungeonText } from '../../src/app/dungeons/text/dungeonText';
import type { DungeonJob, DungeonRendered } from '../../src/app/dungeons/worker/dungeonJob';
import { DungeonGeneratorPanel } from '../../src/app/packages/components/dungeon-generator/DungeonGeneratorPanel';
import { AssetService } from '../../src/app/services/AssetService';
import { SettingsService } from '../../src/app/services/SettingsService';
import { stubLayout } from '../mocks/jsdomLayout';

const worker = vi.hoisted(() => ({ preview: vi.fn(), render: vi.fn() }));
vi.mock('../../src/app/dungeons/worker/DungeonWorkerClient', () => ({ DungeonWorkerClient: { forApp: () => worker } }));
vi.mock('../../src/app/dungeons/scene/createDungeonScene', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/app/dungeons/scene/createDungeonScene')>(),
  createDungeonScene: vi.fn(),
}));

stubLayout({ width: 800, height: 560 });

/** The worker as the panel sees it: the dungeon of the job's request, drawn as nothing. */
function answer(job: DungeonJob): Promise<DungeonRendered> {
  const model = job.model ?? generateDungeon(job.request, dungeonText);
  const bitmap = { width: 10, height: 10, close: vi.fn() } as unknown as ImageBitmap;
  return Promise.resolve({ model, image: { type: 'bitmap', bitmap }, page: { map: { angle: 0, scale: 1, pivot: { x: 0, y: 0 }, at: { x: 0, y: 0 } }, notes: [], rooms: [], title: null, story: null } });
}

const assets = { initialize: vi.fn().mockResolvedValue(undefined) } as unknown as AssetService;
let app: App;
let settings: SettingsService;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  app = { scope: {}, keymap: { pushScope: vi.fn(), popScope: vi.fn() } } as unknown as App;
  settings = new SettingsService(app);
  worker.preview.mockImplementation(answer);
  vi.spyOn(AssetService, 'getInstance').mockReturnValue(assets);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderPanel(onCreated = vi.fn()): ReturnType<typeof vi.fn> {
  render(<DungeonGeneratorPanel app={app} collectionId="Dungeons" initialName="Sunken Vault" onCreated={onCreated} />);
  return onCreated;
}

const lastJob = (): DungeonJob => worker.preview.mock.calls.at(-1)![0] as DungeonJob;
const tag = (name: string): HTMLElement => screen.getByRole('button', { name, pressed: undefined });

describe('the dungeon generator panel', () => {
  it('draws the page of the typed name off the main thread', async () => {
    renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    const job = lastJob();
    expect(job.request.name).toBe('Sunken Vault');
    expect(job.output).toMatchObject({ kind: 'page' });
    expect(job.model).toBeUndefined();
    expect(await screen.findByRole('img', { name: 'Dungeon preview' })).toBeTruthy();
  });

  it('lets one tag of a group stand, and generates with the same seed', async () => {
    renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    const seed = lastJob().request.seed;
    fireEvent.click(tag('small'));
    fireEvent.click(tag('large'));
    expect(tag('small').getAttribute('aria-pressed')).toBe('false');
    expect(tag('large').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(lastJob().request.tags).toEqual(['large']));
    expect(lastJob().request.seed).toBe(seed);
    expect(settings.getDungeonGenerator().tags).toEqual(['large']);

    fireEvent.click(screen.getByRole('button', { name: 'Random' }));
    await waitFor(() => expect(lastJob().request.seed).not.toBe(seed));
  });

  it('keeps what is shown in Atlas settings', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: 'Monochrome' }));
    expect(settings.getDungeonGenerator().view.monochrome).toBe(true);
    await waitFor(() => expect(lastJob().view.monochrome).toBe(true));
  });

  it('creates the scene of the dungeon as shown and hands it on', async () => {
    vi.mocked(createDungeonScene).mockResolvedValue({ ok: true, name: 'Sunken Vault', scenePath: 'atlas-vtt/collections/Dungeons/scenes/Sunken Vault.atlasmap', notePath: 'n.md' });
    const onCreated = renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ }).hasAttribute('disabled')).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ name: 'Sunken Vault', scenePath: 'atlas-vtt/collections/Dungeons/scenes/Sunken Vault.atlasmap' }));
    const [, service, options] = vi.mocked(createDungeonScene).mock.calls[0]!;
    expect(service).toBe(assets);
    expect(options).toMatchObject({ collectionId: 'Dungeons', request: { name: 'Sunken Vault' } as Partial<DungeonRequest> });
    expect(options.model?.title).toBeTruthy();
    expect(options.style).toEqual(settings.getDungeonGenerator().style);
  });

  it('says why a scene could not be created', async () => {
    vi.mocked(createDungeonScene).mockResolvedValue({ ok: false, problem: 'The collection no longer exists.' });
    const onCreated = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    expect(await screen.findByText('The collection no longer exists.')).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
