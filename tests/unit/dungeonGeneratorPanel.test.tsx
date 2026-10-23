// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { generateDungeon } from '../../src/app/dungeons/generate';
import { DEFAULT_STYLE_ID, DUNGEON_STYLES, dungeonStyle } from '../../src/app/dungeons/styleCatalog';
import { mapLayout } from '../../src/app/dungeons/render/layoutSize';
import { roomCentre } from '../../src/app/dungeons/render/geometry';
import { createDungeonScene } from '../../src/app/dungeons/scene/createDungeonScene';
import type { DungeonJob, DungeonRendered } from '../../src/app/dungeons/worker/dungeonJob';
import { DungeonGeneratorPanel } from '../../src/app/packages/components/dungeon-generator/DungeonGeneratorPanel';
import { useDungeonState } from '../../src/app/packages/components/dungeon-generator/useDungeonState';
import { AssetService } from '../../src/app/services/AssetService';
import { SettingsService } from '../../src/app/services/SettingsService';
import { stubLayout } from '../mocks/jsdomLayout';

const worker = vi.hoisted(() => ({ preview: vi.fn(), render: vi.fn(), thumbnail: vi.fn(), dropThumbnails: vi.fn() }));
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
  worker.thumbnail.mockImplementation(answer);
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
    expect(options.model?.floors[0]?.rooms.length).toBeGreaterThan(0);
    expect(options.style).toBe(dungeonStyle(settings.getDungeonGenerator().style));
  });

  it('says why a scene could not be created', async () => {
    vi.mocked(createDungeonScene).mockResolvedValue({ ok: false, problem: 'The collection no longer exists.' });
    const onCreated = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    expect(await screen.findByText('The collection no longer exists.')).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('folds a sidebar section away by its title, keeping what it holds', async () => {
    renderPanel();
    await waitFor(() => expect(worker.thumbnail).toHaveBeenCalledTimes(DUNGEON_STYLES.length));
    const style = screen.getByRole('button', { name: 'Style' });
    expect(style.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(style);
    expect(style.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('radiogroup', { name: 'Style' })).toBeNull();
    fireEvent.click(style);
    expect(screen.getByRole('radiogroup', { name: 'Style' })).toBeTruthy();
    // The cards drawn before are kept for the unfolded gallery
    expect(worker.thumbnail).toHaveBeenCalledTimes(DUNGEON_STYLES.length);
  });

  it('offers the collections where the GM may choose one', () => {
    const onCollectionChange = vi.fn();
    render(
      <DungeonGeneratorPanel
        app={app}
        collectionId="Dungeons"
        collections={[{ id: 'Dungeons', name: 'Dungeons' }, { id: 'Ruins', name: 'Ruins' }] as never}
        onCollectionChange={onCollectionChange}
        onCreated={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Collection' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Dungeons/ }));
    fireEvent.click(screen.getByRole('option', { name: /Ruins/ }));
    expect(onCollectionChange).toHaveBeenCalledWith('Ruins');
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

describe('floors, the boss room and five-room dungeons', () => {
  const floorSwitcher = (): HTMLElement | null => screen.queryByRole('radiogroup', { name: 'Floor shown' });

  it('asks for as many floors as the stepper says, one to four', async () => {
    renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    const fewer = screen.getByRole('button', { name: 'Fewer floors' });
    const more = screen.getByRole('button', { name: 'More floors' });
    expect(lastJob().request.floors).toBe(1);
    expect(fewer.hasAttribute('disabled')).toBe(true);
    for (let floors = 2; floors <= 4; floors++) {
      fireEvent.click(more);
      await waitFor(() => expect(lastJob().request.floors).toBe(floors));
    }
    expect(more.hasAttribute('disabled')).toBe(true);
    fireEvent.click(fewer);
    await waitFor(() => expect(lastJob().request.floors).toBe(3));
  });

  it('shows the floor picked above the preview, drawing that floor of the same dungeon', async () => {
    renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    expect(floorSwitcher()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More floors' }));
    const switcher = await screen.findByRole('radiogroup', { name: 'Floor shown' });
    expect(within(switcher).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['A', 'B']);
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ }).hasAttribute('disabled')).toBe(false));
    const { request } = lastJob();
    const thumbnails = worker.thumbnail.mock.calls.length;

    fireEvent.click(within(switcher).getByRole('radio', { name: 'B' }));
    await waitFor(() => expect(lastJob().output).toMatchObject({ kind: 'preview', floor: 1 }));
    expect(lastJob().request).toBe(request);
    expect(within(switcher).getByRole('radio', { name: 'B' }).getAttribute('aria-checked')).toBe('true');
    // The style cards keep showing floor A
    await act(async () => { await Promise.resolve(); });
    expect(worker.thumbnail.mock.calls.length).toBe(thumbnails);
  });

  it('builds the boss room unless switched off', async () => {
    renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    const boss = screen.getByRole('switch', { name: 'Boss room' });
    expect(boss.getAttribute('aria-checked')).toBe('true');
    expect(lastJob().request.bossRoom).not.toBe(false);
    fireEvent.click(boss);
    await waitFor(() => expect(lastJob().request.bossRoom).toBe(false));
  });

  it('makes a five-room dungeon one floor, its boss room fixed', async () => {
    renderPanel();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'More floors' }));
    await screen.findByRole('radiogroup', { name: 'Floor shown' });
    fireEvent.click(screen.getByRole('switch', { name: 'Boss room' }));

    fireEvent.click(screen.getByRole('switch', { name: 'Five-room dungeon' }));
    await waitFor(() => expect(lastJob().request.fiveRoom).toBe(true));
    expect(floorSwitcher()).toBeNull();
    expect(lastJob().output).toMatchObject({ kind: 'preview', floor: 0 });
    const floors = screen.getByRole('group', { name: 'Floors' });
    expect(floors.getAttribute('aria-disabled')).toBe('true');
    expect(floors.querySelector('output')?.textContent).toBe('1');
    const boss = screen.getByRole('switch', { name: 'Boss room' });
    expect([boss.getAttribute('aria-checked'), boss.getAttribute('aria-disabled')]).toEqual(['true', 'true']);

    // Switched off again, the dungeon has the floors asked for before
    fireEvent.click(screen.getByRole('switch', { name: 'Five-room dungeon' }));
    expect(await screen.findByRole('radiogroup', { name: 'Floor shown' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Boss room' }).getAttribute('aria-checked')).toBe('false');
  });

  it('hides the secret rooms right-clicked on the floor shown', async () => {
    const seed = Array.from({ length: 40 }, (_, k) => k + 1)
      .find((candidate) => generateDungeon({ seed: candidate, tags: [], floors: 2, bossRoom: true, fiveRoom: false }).floors[1]?.rooms.some((room) => room.wing === 'secret'))!;
    renderPanel();
    const seedField = screen.getByRole('textbox', { name: 'Seed' });
    fireEvent.change(seedField, { target: { value: String(seed) } });
    fireEvent.blur(seedField);
    fireEvent.click(screen.getByRole('button', { name: 'More floors' }));
    fireEvent.click(within(await screen.findByRole('radiogroup', { name: 'Floor shown' })).getByRole('radio', { name: 'B' }));
    await waitFor(() => expect(lastJob().output).toMatchObject({ floor: 1 }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ }).hasAttribute('disabled')).toBe(false));

    // The answer is 10 px wide at 1 px a cell, the canvas 800 px wide: 80 client px a map pixel
    const model = generateDungeon(lastJob().request);
    const map = mapLayout(model, 1);
    const centre = roomCentre(model.floors[1]!.rooms.find((room) => room.wing === 'secret')!);
    const client = { clientX: (centre.x - map.originCell.x) * 80, clientY: (centre.y - map.originCell.y) * 80 };
    fireEvent.contextMenu(screen.getByRole('img', { name: 'Dungeon preview' }), client);
    fireEvent.click(await screen.findByText('Hide these secret rooms'));
    await waitFor(() => expect(lastJob().model?.floors[1]?.hiddenWings).toHaveLength(1));
    expect(lastJob().model?.floors[0]?.hiddenWings).toBeUndefined();
    expect(lastJob().output).toMatchObject({ floor: 1 });
  });

  it('explains the two switches in a line each', () => {
    renderPanel();
    for (const [name, hint] of [['Boss room', 'A large arena'], ['Five-room dungeon', 'Five main rooms']] as const) {
      const id = screen.getByRole('switch', { name }).getAttribute('aria-describedby')!;
      expect(document.getElementById(id)?.textContent).toContain(hint);
    }
  });
});

describe('the style gallery', () => {
  it('offers every style as one radio group, the chosen one checked', () => {
    renderPanel();
    const group = screen.getByRole('radiogroup', { name: 'Style' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(DUNGEON_STYLES.length);
    const chosen = within(group).getByRole('radio', { checked: true });
    expect(chosen.textContent).toBe('Scriptorium');
    // Tab reaches only the chosen card
    expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([chosen]);
  });

  it('keeps the style picked by its id and draws the map in it', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('radio', { name: 'Lantern' }));
    expect(settings.getDungeonGenerator().style).toBe('night');
    expect(screen.getByRole('radio', { name: 'Lantern' }).getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(lastJob().style).toBe(dungeonStyle('night')));
  });

  it('moves the choice with the arrow keys, Home and End', () => {
    renderPanel();
    const first = screen.getByRole('radio', { name: 'Scriptorium' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const second = DUNGEON_STYLES[1]!.id;
    expect(settings.getDungeonGenerator().style).toBe(second);
    expect(document.activeElement?.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(settings.getDungeonGenerator().style).toBe(DUNGEON_STYLES.at(-1)!.id);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(settings.getDungeonGenerator().style).toBe(DEFAULT_STYLE_ID);
  });

  it('draws a thumbnail of the dungeon as shown in every style, the chosen one first', async () => {
    settings.setDungeonGenerator({ style: 'volcanic' });
    renderPanel();
    await waitFor(() => expect(worker.thumbnail).toHaveBeenCalledTimes(DUNGEON_STYLES.length));
    const jobs = worker.thumbnail.mock.calls.map(([job]) => job as DungeonJob);
    expect(jobs[0]!.style).toBe(dungeonStyle('volcanic'));
    expect(new Set(jobs.map((job) => job.style)).size).toBe(DUNGEON_STYLES.length);
    expect(jobs.every((job) => job.output.kind === 'thumbnail' && job.model !== undefined)).toBe(true);
  });

  it('asks for no thumbnail again for a dungeon and view it has drawn, and drops those of the last view', async () => {
    renderPanel();
    await waitFor(() => expect(worker.thumbnail).toHaveBeenCalledTimes(DUNGEON_STYLES.length));
    fireEvent.click(screen.getByRole('switch', { name: 'Monochrome' }));
    expect(worker.dropThumbnails).toHaveBeenCalled();
    await waitFor(() => expect(worker.thumbnail).toHaveBeenCalledTimes(DUNGEON_STYLES.length * 2));
    fireEvent.click(screen.getByRole('switch', { name: 'Monochrome' }));
    await act(async () => { await Promise.resolve(); });
    expect(worker.thumbnail).toHaveBeenCalledTimes(DUNGEON_STYLES.length * 2);
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
    const secret = result.current.model!.floors[0]!.rooms.find((room) => room.wing === 'secret');
    if (!secret) return;
    act(() => result.current.hideWing(secret.id));
    expect(result.current.edits.hiddenWings?.length).toBe(1);
    act(() => result.current.newSeed());
    expect(result.current.edits).toEqual({});
  });

  it('hides a secret wing on the floor it lies on', () => {
    const seed = Array.from({ length: 40 }, (_, k) => k + 1)
      .find((candidate) => generateDungeon({ seed: candidate, tags: [], floors: 2 }).floors[1]?.rooms.some((room) => room.wing === 'secret'));
    expect(seed).toBeDefined();
    const { result } = renderHook(() => useDungeonState(app));
    act(() => result.current.setSeed(seed!));
    act(() => result.current.setFloors(2));
    const request = result.current.request;
    act(() => result.current.setGenerated(request, generateDungeon(request)));
    const secret = result.current.model!.floors[1]!.rooms.find((room) => room.wing === 'secret')!;
    act(() => result.current.hideWing(1, secret.id));
    expect(result.current.edits.hiddenWings).toEqual([{ floor: 1, wing: expect.any(Number) }]);
    expect(result.current.model!.floors[1]!.hiddenWings).toHaveLength(1);
    expect(result.current.model!.floors[0]!.hiddenWings).toBeUndefined();
  });

  it('shows the deepest floor there is while fewer are asked for, and the one picked again once they are back', () => {
    const { result } = renderHook(() => useDungeonState(app));
    act(() => result.current.setFloors(3));
    act(() => result.current.setFloor(2));
    expect(result.current.floor).toBe(2);
    act(() => result.current.setFloors(2));
    expect(result.current.floor).toBe(1);
    act(() => result.current.setFloors(3));
    expect(result.current.floor).toBe(2);
    act(() => result.current.setFiveRoom(true));
    expect([result.current.floors, result.current.floor]).toEqual([1, 0]);
  });
});
