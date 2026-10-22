// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openCreatedScene } from '../../src/app/import/openCreatedScene';
import { DungeonGeneratorOverlay } from '../../src/app/packages/components/dungeon-generator/DungeonGeneratorOverlay';
import type { DungeonGeneratorPanelProps } from '../../src/app/packages/components/dungeon-generator/DungeonGeneratorPanel';
import { generateDungeonFor, showDungeonGenerator } from '../../src/app/packages/components/dungeon-generator/openDungeonGenerator';
import { AtlasUIContext } from '../../src/app/react/root/AtlasUIContext';
import { ViewStoreProvider } from '../../src/app/react/ViewStoreContext';
import { createViewAtlasStore, type ViewAtlasStore } from '../../src/app/storeFactory';
import { canRunMapHotkeys } from '../../src/app/keyboard/mapHotkeys';
import { loadAtlasView } from '../../src/app/plugin/atlasLeaves';
import { createInMemoryApp } from '../mocks/inMemoryVault';

const panel = vi.hoisted(() => ({ props: null as DungeonGeneratorPanelProps | null }));
vi.mock('../../src/app/packages/components/dungeon-generator/DungeonGeneratorPanel', () => ({
  DungeonGeneratorPanel: (props: DungeonGeneratorPanelProps) => {
    panel.props = props;
    return <div>{props.header}</div>;
  },
}));
vi.mock('../../src/app/plugin/atlasLeaves', () => ({ loadAtlasView: vi.fn() }));
vi.mock('../../src/app/import/openCreatedScene', () => ({ openCreatedScene: vi.fn(async () => true) }));
vi.mock('../../src/app/packages/components/asset-manager/token-creator/useAssetCatalog', () => ({
  useAssetCatalog: () => ({ assetService: {}, collections: [{ id: 'Dungeons', name: 'Dungeons' }, { id: 'Ruins', name: 'Ruins' }] }),
}));

const SCENE = { name: 'Crypt', scenePath: 'atlas-vtt/collections/Dungeons/scenes/Crypt.atlasmap' };

function mount(): { store: ViewAtlasStore; app: ReturnType<typeof createInMemoryApp>['app'] } {
  const { app } = createInMemoryApp({ files: {} });
  const store = createViewAtlasStore(app, `overlay-${Math.random()}`);
  store.getState().setPersistenceEnabled(false);
  render(
    <AtlasUIContext.Provider value={{ app, view: null, pixiApp: null, renderer: null }}>
      <ViewStoreProvider store={store}>
        <DungeonGeneratorOverlay />
      </ViewStoreProvider>
    </AtlasUIContext.Provider>,
  );
  return { store, app };
}

afterEach(() => {
  cleanup();
  panel.props = null;
  vi.clearAllMocks();
});

describe('the dungeon generator over the map', () => {
  it('fills the view for a pin, closes with its X and tells the pin no scene came', async () => {
    const { store } = mount();
    expect(screen.queryByRole('dialog')).toBeNull();
    let result: Promise<{ scenePath: string } | null> = Promise.resolve(null);
    act(() => { result = generateDungeonFor(store, { name: 'Crypt', collectionId: 'Dungeons' }); });
    const dialog = screen.getByRole('dialog', { name: 'Dungeon generator' });
    expect(dialog.classList.contains('atlas-dungeon-generator-overlay')).toBe(true);
    // A pin fixes the name and the collection
    expect(panel.props).toMatchObject({ initialName: 'Crypt', collectionId: 'Dungeons', collections: undefined, onCollectionChange: undefined });
    // The map's shortcuts wait while it is open
    expect(canRunMapHotkeys(new KeyboardEvent('keydown', { key: 'v' }))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await expect(result).resolves.toBeNull();
  });

  it('hands a pin its scene and shows the map again without opening the scene', async () => {
    const { store } = mount();
    let result: Promise<{ scenePath: string } | null> = Promise.resolve(null);
    act(() => { result = generateDungeonFor(store, { name: 'Crypt', collectionId: 'Dungeons' }); });
    act(() => panel.props!.onCreated(SCENE));
    await expect(result).resolves.toEqual({ scenePath: SCENE.scenePath });
    expect(store.getState().dungeonGenerator).toBeNull();
    expect(openCreatedScene).not.toHaveBeenCalled();
  });

  it('opens from the asset manager with a choice of collection, and opens the scene it created', async () => {
    const { store, app } = mount();
    const view = { leaf: {}, getStore: () => store };
    vi.mocked(loadAtlasView).mockResolvedValue(view as never);
    Object.assign(app.workspace, { revealLeaf: vi.fn(async () => {}) });
    await act(() => showDungeonGenerator(app, 'Ruins'));
    expect(panel.props).toMatchObject({ initialName: '', collectionId: 'Ruins' });
    expect(panel.props!.collections).toHaveLength(2);
    act(() => panel.props!.onCollectionChange!('Dungeons'));
    expect(panel.props!.collectionId).toBe('Dungeons');
    act(() => panel.props!.onCreated(SCENE));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(openCreatedScene).toHaveBeenCalledWith(app, SCENE.scenePath, 'Crypt');
  });

  it('closes on Escape, but not while a scene is being written', () => {
    const { store } = mount();
    act(() => { void generateDungeonFor(store, { name: 'Crypt', collectionId: 'Dungeons' }); });
    act(() => panel.props!.onBusyChange!(true));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeDefined();
    act(() => panel.props!.onBusyChange!(false));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
