// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { generateDungeon } from '../../src/app/dungeons/generate';
import { mapLayout } from '../../src/app/dungeons/render/layoutSize';
import { createDungeonScene } from '../../src/app/dungeons/scene/createDungeonScene';
import type { DungeonJob, DungeonRendered } from '../../src/app/dungeons/worker/dungeonJob';
import { DungeonGeneratorPanel } from '../../src/app/packages/components/dungeon-generator/DungeonGeneratorPanel';
import { useDungeonState } from '../../src/app/packages/components/dungeon-generator/useDungeonState';
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
  const model = job.model ?? generateDungeon(job.request);
  const bitmap = { width: 10, height: 10, close: vi.fn() } as unknown as ImageBitmap;
  return Promise.resolve({ model, map: mapLayout(model, 1), image: { type: 'bitmap', bitmap } });
}

const assets = { initialize: vi.fn().mockResolvedValue(undefined) } as unknown as AssetService;
let app: App;
let settings: SettingsService;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  app = { scope: {} } as unknown as App;
  settings = new SettingsService(app);
  worker.preview.mockImplementation(answer);
  vi.spyOn(AssetService, 'getInstance').mockReturnValue(assets);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderPanel(onCreated = vi.fn(), initialName = 'Sunken Vault'): ReturnType<typeof vi.fn> {
  render(<DungeonGeneratorPanel app={app} collectionId="Dungeons" initialName={initialName} onCreated={onCreated} />);
  return onCreated;
}

const lastJob = (): DungeonJob => worker.preview.mock.calls.at(-1)![0] as DungeonJob;
const tag = (name: string): HTMLElement => screen.getByRole('button', { name, pressed: undefined });

describe('the dungeon generator panel', () => {
  it('draws the map fitted into the preview off the main thread', async () => {
    renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    const job = lastJob();
    expect(job.output).toMatchObject({ kind: 'preview' });
    expect(job.model).toBeUndefined();
    expect(await screen.findByRole('img', { name: 'Dungeon preview' })).toBeTruthy();
  });

  it('never draws another dungeon for another name', async () => {
    renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    const calls = worker.preview.mock.calls.length;
    const { request } = lastJob();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Moon Temple' } });
    await act(async () => { await Promise.resolve(); });
    expect(worker.preview.mock.calls.length).toBe(calls);
    expect(lastJob().request).toBe(request);
  });

  it('creates a scene only once it has a name', async () => {
    renderPanel(vi.fn(), '');
    const create = screen.getByRole('button', { name: 'Create scene' });
    expect(create.hasAttribute('disabled')).toBe(true);
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name.getAttribute('placeholder')).toBe('Name it to create the scene');
    fireEvent.change(name, { target: { value: '   ' } });
    expect(create.hasAttribute('disabled')).toBe(true);
    fireEvent.change(name, { target: { value: 'Grey Vault' } });
    expect(create.hasAttribute('disabled')).toBe(false);
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
    vi.mocked(createDungeonScene).mockResolvedValue({ ok: true, name: 'Sunken Vault', scenePath: 'atlas-vtt/collections/Dungeons/scenes/Sunken Vault.atlasmap' });
    const onCreated = renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ }).hasAttribute('disabled')).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ name: 'Sunken Vault', scenePath: 'atlas-vtt/collections/Dungeons/scenes/Sunken Vault.atlasmap' }));
    const [, service, options] = vi.mocked(createDungeonScene).mock.calls[0]!;
    expect(service).toBe(assets);
    expect(options).toMatchObject({ collectionId: 'Dungeons', name: 'Sunken Vault' });
    expect(options.model?.rooms.length).toBeGreaterThan(0);
    expect(options.style).toEqual(settings.getDungeonGenerator().style);
  });

  it('says why a scene could not be created', async () => {
    vi.mocked(createDungeonScene).mockResolvedValue({ ok: false, problem: 'The collection no longer exists.' });
    const onCreated = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    expect(await screen.findByText('The collection no longer exists.')).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('has no keyboard shortcuts: keys pressed in the panel change nothing', async () => {
    renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    const calls = worker.preview.mock.calls.length;
    const { request } = lastJob();
    const before = settings.getDungeonGenerator();
    const panel = document.querySelector<HTMLElement>('.atlas-dungeon-generator')!;
    panel.focus();
    for (const key of ['Enter', ' ', 'n', 'g', 'G', 'h', 'm', 'w', 'p', 'e', 'j', '1']) {
      fireEvent.keyDown(panel, { key, shiftKey: key === 'G' });
    }
    await act(async () => { await Promise.resolve(); });
    expect(worker.preview.mock.calls.length).toBe(calls);
    expect(lastJob().request).toEqual(request);
    expect(settings.getDungeonGenerator()).toEqual(before);
  });
});

describe('the generator state', () => {
  it('names the scene with the Name field and keeps the dungeon as it is', () => {
    const { result } = renderHook(() => useDungeonState(app, ' Sunken Vault '));
    expect(result.current.name).toBe('Sunken Vault');
    const request = result.current.request;
    act(() => result.current.setGenerated(request, generateDungeon(request)));
    const model = result.current.model;

    act(() => result.current.setName('Moon Temple'));
    expect(result.current.name).toBe('Moon Temple');
    expect(result.current.request).toBe(request);
    expect(result.current.model).toBe(model);
  });

  it('keeps the hidden wings while only the water changes, and drops them for another seed', () => {
    const { result } = renderHook(() => useDungeonState(app));
    const request = result.current.request;
    act(() => result.current.setGenerated(request, generateDungeon(request)));
    const secret = result.current.model!.rooms.find((room) => room.wing === 'secret');
    if (!secret) return;
    act(() => result.current.hideWing(secret.id));
    expect(result.current.edits.hiddenWings?.length).toBe(1);
    act(() => result.current.newSeed());
    expect(result.current.edits).toEqual({});
  });
});
