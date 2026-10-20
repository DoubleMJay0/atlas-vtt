import { describe, expect, it } from 'vitest';
import { placeCombatantOnMap } from '../../src/app/initiative/placeCombatant';
import { addOffMapCombatants } from '../../src/app/initiative/offMapCombatants';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { getHistoryStore } from '../../src/app/stores/history';
import type { AtlasView } from '../../src/app/atlas-view';
import type { TokenInput } from '../../src/app/types/viewState';
import { createInMemoryApp } from '../mocks/inMemoryVault';

function scene(snaps: boolean) {
  const { app } = createInMemoryApp();
  const store = createViewAtlasStore(app, `place-${Math.random()}`);
  store.setState({ persistenceEnabled: false, mapPath: 'maps/cave.atlasmap', isMapLoading: false });
  const viewport = { screenWidth: 800, screenHeight: 600, toWorld: (p: { x: number; y: number }) => ({ x: p.x + 1000, y: p.y + 500 }), scale: { x: 1 } };
  const gridSystem = { getOptions: () => ({ type: 'square', size: 70, enabled: true }), snapTokenCenter: (x: number, y: number) => ({ x: Math.round(x / 70) * 70 + 35, y: Math.round(y / 70) * 70 + 35 }) };
  const view = {
    getStore: () => store,
    serviceManager: { getRendererService: () => ({ getViewport: () => viewport, getGridSystem: () => (snaps ? gridSystem : null) }) },
  } as unknown as AtlasView;
  return { store, view };
}

describe('placing a combatant kept beside the map', () => {
  it('puts it in the middle of what the GM sees, on the grid, in one undo step', () => {
    const { store, view } = scene(true);
    const [id] = addOffMapCombatants(store, [{ kind: 'token', x: 0, y: 0, imagePath: 'art/goblin.png' } as TokenInput]);
    const history = getHistoryStore(store)!;
    history.getState().clear();
    placeCombatantOnMap(view, id!);
    expect(store.getState().objects.tokens[id!]).toMatchObject({ x: 1435, y: 805 });
    expect(store.getState().objects.tokens[id!]?.offMap).toBeUndefined();
    expect(history.getState().pastStates).toHaveLength(1);
  });

  it('leaves a token on the map where it is', () => {
    const { store, view } = scene(false);
    store.getState().addTokens([{ id: 'wolf', kind: 'token', x: 10, y: 20, imagePath: 'art/wolf.png' } as TokenInput]);
    placeCombatantOnMap(view, 'wolf');
    expect(store.getState().objects.tokens.wolf).toMatchObject({ x: 10, y: 20 });
  });
});
