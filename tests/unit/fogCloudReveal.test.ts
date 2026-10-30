import { describe, expect, it } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { getHistoryStore } from '../../src/app/stores/history';
import { DEFAULT_FOG_STYLE, readFogStyle } from '../../src/app/fog/fogStyle';
import { playersFog } from '../../src/app/fog/playersFog';
import { levelObjects } from '../../src/app/levels/levelObjects';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import type { FogOperation } from '../../src/app/types/fogTypes';
import type { SceneLevel } from '../../src/app/types/sceneLevelTypes';

function createStore(): ReturnType<typeof createViewAtlasStore> {
  const { app } = createInMemoryApp();
  const store = createViewAtlasStore(app, `fog-${Math.random()}`);
  store.setState({ persistenceEnabled: false });
  return store;
}

const paint = (store: ReturnType<typeof createStore>, x: number): string =>
  store.getState().addFogOperation({ type: 'rectangle', isErasing: false, x, y: 0, width: 100, height: 100 });

describe('cloud reveal', () => {
  it('shows players fog edits at once while it is off', () => {
    const store = createStore();
    store.getState().setActiveTool('fog');
    paint(store, 0);
    expect(store.getState().fogHeld).toBeNull();
    expect(playersFog(store.getState())).toBe(store.getState().objects.fog);
  });

  it('keeps players on the fog from before an edit until the GM leaves the fog tools', () => {
    const store = createStore();
    paint(store, 0);
    const before = store.getState().objects.fog;
    store.getState().setFogStyle({ clouds: true });
    store.getState().setActiveTool('fog');

    paint(store, 200);
    store.getState().setActiveTool('eraser');
    store.getState().addFogOperation({ type: 'rectangle', isErasing: true, x: 0, y: 0, width: 50, height: 50 });
    expect(playersFog(store.getState())).toBe(before);

    store.getState().setActiveTool('move');
    expect(store.getState().fogHeld).toBeNull();
    expect(playersFog(store.getState())).toBe(store.getState().objects.fog);
    expect(Object.keys(playersFog(store.getState()))).toHaveLength(3);
  });

  it('holds undo and redo of fog while the fog tools are taken up, and never makes the hold an undo step', () => {
    const store = createStore();
    const history = getHistoryStore(store)!;
    paint(store, 0);
    store.getState().setFogStyle({ clouds: true });
    const steps = history.getState().pastStates.length;
    store.getState().setActiveTool('fog');
    const held = playersFog(store.getState());
    expect(history.getState().pastStates.length).toBe(steps);

    store.temporal.getState().undo();
    expect(store.getState().objects.fog).toEqual({});
    expect(playersFog(store.getState())).toBe(held);
  });

  it('lets the fog go when cloud reveal is switched off, and holds it when switched on during an edit', () => {
    const store = createStore();
    store.getState().setActiveTool('fog');
    paint(store, 0);
    store.getState().setFogStyle({ clouds: true });
    const held = store.getState().objects.fog;
    paint(store, 200);
    expect(playersFog(store.getState())).toBe(held);

    store.getState().setFogStyle({ clouds: false });
    expect(playersFog(store.getState())).toBe(store.getState().objects.fog);
  });

  it('keeps the fog on a colour change', () => {
    const store = createStore();
    store.getState().setFogStyle({ clouds: true });
    store.getState().setActiveTool('fog');
    const held = store.getState().objects.fog;
    paint(store, 0);
    store.getState().setFogStyle({ color: '#c9ced6' });
    expect(playersFog(store.getState())).toBe(held);
  });

  it('never holds the fog of a player view', () => {
    const { app } = createInMemoryApp();
    const store = createViewAtlasStore(app, `fog-player-${Math.random()}`, undefined, true);
    store.getState().setFogStyle({ clouds: true });
    store.setState({ activeTool: 'fog' });
    store.getState().setActiveTool('fog');
    expect(store.getState().fogHeld).toBeNull();
  });

  it('holds a scene loaded during an edit on its own fog, and starts a cleared scene flat', () => {
    const store = createStore();
    store.getState().setFogStyle({ clouds: true });
    store.getState().setActiveTool('fog');
    paint(store, 0);

    const fog = { a: { id: 'a', kind: 'fog', timestamp: 1, type: 'rectangle', isErasing: false, x: 0, y: 0, width: 10, height: 10 } };
    const loaded = store.persist.getOptions().merge!({ objects: { ...store.getState().objects, fog }, fogStyle: { clouds: true, color: '#22332a' } }, store.getState());
    expect(loaded.fogHeld).toEqual(fog);
    expect(loaded.fogStyle).toEqual({ clouds: true, color: '#22332a' });

    store.getState().clearMapState();
    expect(store.getState().fogHeld).toBeNull();
    expect(store.getState().fogStyle).toEqual(DEFAULT_FOG_STYLE);
  });

  it('saves the fog style with the scene but never the held fog, and never makes a style change an undo step', () => {
    const store = createStore();
    const history = getHistoryStore(store)!;
    const steps = history.getState().pastStates.length;
    store.getState().setFogStyle({ clouds: true, color: '#4a1f24' });
    store.getState().setActiveTool('fog');
    expect(history.getState().pastStates.length).toBe(steps);

    store.setState({ persistenceEnabled: true });
    const saved = store.persist.getOptions().partialize?.(store.getState()) as Record<string, unknown>;
    expect(saved.fogStyle).toEqual({ clouds: true, color: '#4a1f24' });
    expect(saved).not.toHaveProperty('fogHeld');
  });

  it('reads a fog style from a file, flat where the file holds none or something else', () => {
    expect(readFogStyle(undefined)).toEqual(DEFAULT_FOG_STYLE);
    expect(readFogStyle('clouds')).toEqual(DEFAULT_FOG_STYLE);
    expect(readFogStyle({ clouds: 'yes', color: 'red' })).toEqual(DEFAULT_FOG_STYLE);
    expect(readFogStyle({ clouds: true, color: '#C9CED6' })).toEqual({ clouds: true, color: '#c9ced6' });
  });

  it('shows players the held fog of the level the view shows', () => {
    const levels = [{ id: 'cellar' }, { id: 'hall' }] as unknown as SceneLevel[];
    const op = (level: string): FogOperation => ({ id: level, type: 'rectangle', isErasing: false, x: 0, y: 0, width: 10, height: 10, level }) as FogOperation;
    const held = { cellar: op('cellar'), hall: op('hall') };
    const objects = { fog: { ...held, later: op('hall') } };

    const hall = playersFog({ objects, fogHeld: held, levels, viewedLevel: 'hall' });
    expect(Object.keys(hall)).toEqual(['hall']);
    expect(playersFog({ objects, fogHeld: held, levels, viewedLevel: 'hall' })).toBe(hall);
    expect(Object.keys(playersFog({ objects, fogHeld: held, levels, viewedLevel: 'cellar' }))).toEqual(['cellar']);
    expect(Object.keys(playersFog({ objects, fogHeld: null, levels, viewedLevel: 'hall' }))).toEqual(['hall', 'later']);
  });

  it('leaves the objects of the level shown as they were when the players are shown the held fog', () => {
    const levels = [{ id: 'cellar' }, { id: 'hall' }] as unknown as SceneLevel[];
    const op = (level: string): FogOperation => ({ id: level, type: 'rectangle', isErasing: false, x: 0, y: 0, width: 10, height: 10, level }) as FogOperation;
    const walls = { low: { id: 'low', levels: ['cellar'] }, high: { id: 'high', levels: ['hall'] } };
    const token = (id: string, level: string, x: number): { id: string; level: string; x: number } => ({ id, level, x });
    const fog = { cellar: op('cellar'), hall: op('hall') };
    const before = { objects: { walls, fog, tokens: { a: token('a', 'cellar', 0), b: token('b', 'hall', 0) } }, levels, viewedLevel: 'cellar' };
    const shown = levelObjects(before);

    // Held before any edit: the very fog of the level shown
    expect(playersFog({ ...before, fogHeld: fog })).toBe(shown.fog);
    // A token moved on the other level: nothing on the level shown changed
    const after = levelObjects({ ...before, objects: { ...before.objects, tokens: { ...before.objects.tokens, b: token('b', 'hall', 5) } } });
    expect(after.walls).toBe(shown.walls);
    expect(after.tokens).toBe(shown.tokens);
    expect(after.fog).toBe(shown.fog);
  });
});
