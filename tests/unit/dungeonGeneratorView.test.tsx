// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceLeaf, type App } from 'obsidian';
import { createDungeonScene } from '../../src/app/dungeons/scene/createDungeonScene';
import { DUNGEON_GENERATOR_VIEW_TYPE, DungeonGeneratorView } from '../../src/app/packages/components/dungeon-generator/DungeonGeneratorView';
import { openDungeonGenerator, showDungeonGenerator } from '../../src/app/packages/components/dungeon-generator/openDungeonGenerator';
import { AssetService } from '../../src/app/services/AssetService';
import { stubLayout } from '../mocks/jsdomLayout';

const worker = vi.hoisted(() => ({ preview: vi.fn(() => new Promise(() => {})), render: vi.fn(), thumbnail: vi.fn(), dropThumbnails: vi.fn() }));
vi.mock('../../src/app/dungeons/worker/DungeonWorkerClient', () => ({ DungeonWorkerClient: { forApp: () => worker } }));
vi.mock('../../src/app/dungeons/scene/createDungeonScene', () => ({ createDungeonScene: vi.fn() }));
vi.mock('../../src/app/packages/components/asset-manager/token-creator/useAssetCatalog', () => ({
  useAssetCatalog: () => ({ assetService: {}, collections: [{ id: 'Dungeons', name: 'Dungeons' }, { id: 'Ruins', name: 'Ruins' }] }),
}));

stubLayout({ width: 1200, height: 800 });

const SCENE = 'atlas-vtt/collections/Dungeons/scenes/Crypt.atlasmap';

/** A workspace leaf as far as the generator uses one. */
class Leaf extends WorkspaceLeaf {
  declare view: { getViewType: () => string; leaf: Leaf; onClose?: () => Promise<void> } | null;
  readonly openFile = vi.fn(async (): Promise<void> => {});

  constructor(private readonly workspace: FakeWorkspace) {
    super();
    this.app = workspace.app;
  }

  async setViewState({ type, state }: { type: string; state?: unknown }): Promise<void> {
    if (this.view?.getViewType() !== type) {
      await this.view?.onClose?.();
      const view = new DungeonGeneratorView(this as never);
      document.body.append(view.contentEl);
      this.view = view as never;
      await view.onOpen();
    }
    await (this.view as unknown as DungeonGeneratorView).setState(state ?? {}, { history: false });
  }

  async loadIfDeferred(): Promise<void> {}

  detach(): void {
    this.workspace.leaves = this.workspace.leaves.filter((leaf) => leaf !== this);
    void this.view?.onClose?.();
  }
}

class FakeWorkspace {
  leaves: Leaf[] = [];
  readonly app: App;
  readonly map: Leaf;
  readonly setActiveLeaf = vi.fn();
  readonly revealLeaf = vi.fn(async (): Promise<void> => {});
  readonly requestSaveLayout = vi.fn();

  constructor() {
    this.app = { workspace: this, vault: { getFileByPath: () => null } } as unknown as App;
    this.map = new Leaf(this);
    this.map.view = { getViewType: () => 'atlas-vtt', leaf: this.map };
    this.leaves.push(this.map);
  }

  getLeaf(): Leaf {
    const leaf = new Leaf(this);
    this.leaves.push(leaf);
    return leaf;
  }

  getLeavesOfType(type: string): Leaf[] {
    return this.leaves.filter((leaf) => leaf.view?.getViewType() === type);
  }

  iterateAllLeaves(callback: (leaf: Leaf) => void): void {
    this.leaves.forEach(callback);
  }

  getActiveViewOfType(): { leaf: Leaf } {
    return { leaf: this.map };
  }
}

let workspace: FakeWorkspace;
const generators = (): Leaf[] => workspace.getLeavesOfType(DUNGEON_GENERATOR_VIEW_TYPE);
const viewOf = (leaf: Leaf): DungeonGeneratorView => leaf.view as unknown as DungeonGeneratorView;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
  workspace = new FakeWorkspace();
  vi.spyOn(AssetService, 'getInstance').mockReturnValue({ initialize: vi.fn().mockResolvedValue(undefined) } as unknown as AssetService);
});
afterEach(() => { cleanup(); document.body.empty(); vi.restoreAllMocks(); });

describe('the dungeon generator tab', () => {
  it('fills a tab of its own and keeps only the collection with the workspace', async () => {
    await act(() => showDungeonGenerator(workspace.app, { collectionId: 'Ruins' }));
    const [leaf] = generators();
    expect(leaf).toBeDefined();
    const view = viewOf(leaf!);
    expect(view.getDisplayText()).toBe('Dungeon generator');
    expect(view.contentEl.querySelector('.atlas-dungeon-generator__preview')).not.toBeNull();
    expect(view.contentEl.querySelector('.atlas-dungeon-generator__sidebar .atlas-dungeon-generator__footer')).not.toBeNull();
    expect(view.getState()).toEqual({ collectionId: 'Ruins' });
    // The GM chooses the collection here
    expect(await screen.findByRole('button', { name: /Ruins/ })).toBeTruthy();
    await waitFor(() => expect(worker.preview).toHaveBeenCalled());
  });

  it('shows the open generator again instead of a second one', async () => {
    await act(() => showDungeonGenerator(workspace.app, { collectionId: 'Dungeons' }));
    await act(() => showDungeonGenerator(workspace.app, { collectionId: 'Ruins' }));
    expect(generators()).toHaveLength(1);
    expect(workspace.revealLeaf).toHaveBeenCalledWith(generators()[0]);
    expect(viewOf(generators()[0]!).getState()).toEqual({ collectionId: 'Ruins' });
  });

  it('opens the scene it created in its own tab when no Atlas view is open', async () => {
    vi.mocked(createDungeonScene).mockResolvedValue({ ok: true, name: 'Crypt', scenePath: SCENE });
    const scene = { path: SCENE };
    Object.assign(workspace.app.vault, { getFileByPath: () => scene });
    workspace.leaves = [];
    await act(() => showDungeonGenerator(workspace.app, { collectionId: 'Dungeons' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Name' }), { target: { value: 'Crypt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    await waitFor(() => expect(generators()[0]!.openFile).toHaveBeenCalledWith(scene));
    expect(vi.mocked(createDungeonScene).mock.calls[0]![2]).toMatchObject({ name: 'Crypt', collectionId: 'Dungeons' });
  });

  it('opens the scene it created in the Atlas view, and closes', async () => {
    vi.mocked(createDungeonScene).mockResolvedValue({ ok: true, name: 'Crypt', scenePath: SCENE });
    Object.assign(workspace.app.vault, { getFileByPath: () => ({ path: SCENE }) });
    await act(() => showDungeonGenerator(workspace.app, { collectionId: 'Dungeons' }));
    const [leaf] = generators();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Name' }), { target: { value: 'Crypt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    await waitFor(() => expect(workspace.leaves).not.toContain(leaf));
    expect(workspace.revealLeaf).toHaveBeenCalledWith(workspace.map);
    expect(leaf!.openFile).not.toHaveBeenCalled();
  });
});

describe('a scene asked for by the note pin search', () => {
  it('opens a new tab with the name and the collection fixed, and closes it onto the map once created', async () => {
    vi.mocked(createDungeonScene).mockResolvedValue({ ok: true, name: 'Crypt', scenePath: SCENE });
    await act(() => showDungeonGenerator(workspace.app, { collectionId: 'Ruins' }));
    let asked!: Promise<{ scenePath: string } | null>;
    await act(async () => { asked = openDungeonGenerator(workspace.app, { name: 'Crypt', collectionId: 'Dungeons' }); });
    await waitFor(() => expect(generators()).toHaveLength(2));
    const leaf = generators()[1]!;
    expect(viewOf(leaf).hasTask()).toBe(true);

    const name = await waitFor(() => {
      const field = leaf.view && viewOf(leaf).contentEl.querySelector<HTMLInputElement>('input[type="text"]');
      expect(field?.value).toBe('Crypt');
      return field!;
    });
    // The pin links only scenes of its own collection: no collection to choose
    expect(viewOf(leaf).contentEl.querySelector('.atlas-collection-dropdown')).toBeNull();
    expect(name).toBeTruthy();

    const create = [...viewOf(leaf).contentEl.querySelectorAll('button')].find((button) => button.textContent === 'Create scene')!;
    fireEvent.click(create);
    expect(await asked).toEqual({ scenePath: SCENE });
    expect(vi.mocked(createDungeonScene).mock.calls[0]![2]).toMatchObject({ name: 'Crypt', collectionId: 'Dungeons' });
    expect(workspace.leaves).not.toContain(leaf);
    expect(workspace.setActiveLeaf).toHaveBeenCalledWith(workspace.map, { focus: true });
  });

  it('answers null when its tab is closed without a scene, and never lends the tab to another opening', async () => {
    let asked!: Promise<{ scenePath: string } | null>;
    await act(async () => { asked = openDungeonGenerator(workspace.app, { name: 'Crypt', collectionId: 'Dungeons' }); });
    await waitFor(() => expect(generators()).toHaveLength(1));
    const leaf = generators()[0]!;
    await act(() => showDungeonGenerator(workspace.app, { collectionId: 'Ruins' }));
    expect(generators()).toHaveLength(2);

    act(() => leaf.detach());
    expect(await asked).toBeNull();
    expect(createDungeonScene).not.toHaveBeenCalled();
  });
});
