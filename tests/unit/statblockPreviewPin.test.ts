// @vitest-environment jsdom
import { EventEmitter } from 'events';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'obsidian';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { createViewAtlasStore, type ViewAtlasStore } from '../../src/app/storeFactory';
import { NotePreviewUIManager } from '../../src/app/services/NotePreviewUIManager';
import { StatblockPreviewWindow } from '../../src/app/services/StatblockPreviewWindow';

vi.mock('../../src/app/services/FantasyStatblocksService', () => ({
  hasCreatureForNotePath: (): boolean => true,
  getFantasyStatblocksApi: (): object => ({}),
}));
const statblockProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('../../src/app/statblocks/render/LinkedStatblock', () => ({
  LinkedStatblock: (props: Record<string, unknown>): null => {
    statblockProps.push(props);
    return null;
  },
}));

const VIEW_ID = 'statblock-pin-test';
const NOTE_PATH = 'Bestiary/Goblin.md';
const FADE_MS = 150;

function hoverToken(eventBus: EventEmitter, id = 'token-1'): void {
  act(() => {
    eventBus.emit('pin-hover-preview', {
      pin: { id, notePath: NOTE_PATH, x: 0, y: 0, type: 'token', name: 'Goblin' },
      screenX: 100,
      screenY: 100,
      pixiEvent: { metaKey: true, ctrlKey: false },
    });
  });
}

function releaseMod(): void {
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }));
  vi.advanceTimersByTime(FADE_MS);
}

const windows = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.atlas-statblock-preview-window'));
const buttonsOf = (preview: HTMLElement): HTMLButtonElement[] =>
  Array.from(preview.querySelectorAll<HTMLButtonElement>('.atlas-statblock-preview-window__button'));

describe('pinning a statblock preview of a token on the map', () => {
  let manager: NotePreviewUIManager;
  let eventBus: EventEmitter;
  let store: ViewAtlasStore;
  /** Whether the map's tab is the one shown, and the workspace events the manager listens to. */
  let mapShown: boolean;
  let workspaceEvents: Map<string, (leaf?: unknown) => void>;
  const mapLeaf = { view: { viewId: VIEW_ID, getViewType: (): string => 'atlas-vtt', containerEl: { isShown: (): boolean => mapShown } } };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
    Platform.isMacOS = true;
    const { app } = createInMemoryApp({ files: { [NOTE_PATH]: '# Goblin' } });
    mapShown = true;
    workspaceEvents = new Map();
    Object.assign(app.workspace, {
      getLeavesOfType: (type: string) => (type === 'atlas-vtt' ? [mapLeaf] : []),
      on: (name: string, callback: (leaf?: unknown) => void) => { workspaceEvents.set(name, callback); return {}; },
    });
    eventBus = new EventEmitter();
    store = createViewAtlasStore(app, VIEW_ID);
    manager = new NotePreviewUIManager(app, eventBus, store, VIEW_ID);
    statblockProps.length = 0;
  });

  afterEach(() => {
    manager.destroy();
    vi.runOnlyPendingTimers();
    document.body.empty();
    Platform.isMacOS = false;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('closes an unpinned preview when Mod is released', () => {
    hoverToken(eventBus);
    releaseMod();
    expect(windows()).toHaveLength(0);
  });

  it('keeps a pinned preview open on Mod release and on hovering another token, until it is closed', () => {
    hoverToken(eventBus);
    const [preview] = windows();
    const [pin, close] = buttonsOf(preview!);
    pin!.click();
    expect(preview!.classList.contains('is-pinned')).toBe(true);

    releaseMod();
    hoverToken(eventBus, 'token-2');
    releaseMod();
    expect(windows()).toEqual([preview]);

    close!.click();
    vi.advanceTimersByTime(FADE_MS);
    expect(windows()).toHaveLength(0);
  });

  it('pins a preview the GM presses into, and lets it be unpinned again', () => {
    hoverToken(eventBus);
    const [preview] = windows();
    preview!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    releaseMod();
    expect(windows()).toEqual([preview]);

    hoverToken(eventBus, 'token-1');
    buttonsOf(preview!)[0]!.click();
    releaseMod();
    expect(windows()).toHaveLength(0);
  });

  it('moves the window with its controls and keeps it there', () => {
    hoverToken(eventBus);
    const [preview] = windows();
    const controls = preview!.querySelector<HTMLElement>('.atlas-statblock-preview-window__controls')!;
    controls.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 40 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(preview!.style.left).toBe('50px');
    expect(preview!.style.top).toBe('30px');
    releaseMod();
    expect(windows()).toEqual([preview]);
  });

  describe('following its token', () => {
    const unhurt = { hp: { current: 7, max: 7 } };
    const goblin = (changes: object = {}): object => ({
      id: 'token-1', kind: 'character', name: 'Goblin', x: 0, y: 0, imagePath: '', resources: unhurt, ...changes,
    });
    const holdTokens = (tokens: object): void => {
      act(() => { store.setState({ objects: { ...store.getState().objects, tokens } as never }); });
    };

    beforeEach(() => {
      holdTokens({ 'token-1': goblin() });
      hoverToken(eventBus);
      buttonsOf(windows()[0]!)[0]!.click();
    });

    it('shows the token\'s values as they change', () => {
      holdTokens({ 'token-1': goblin({ resources: { hp: { current: 3, max: 7 } } }) });
      const last = statblockProps[statblockProps.length - 1] as { tokens: Array<{ resources: unknown }> };
      expect(last.tokens[0]!.resources).toEqual({ hp: { current: 3, max: 7 } });
    });

    it('draws nothing anew while the token only moves', () => {
      const drawn = statblockProps.length;
      holdTokens({ 'token-1': goblin({ x: 70, y: 140 }) });
      expect(statblockProps).toHaveLength(drawn);
    });

    it('closes once the token is gone', () => {
      holdTokens({});
      vi.advanceTimersByTime(FADE_MS);
      expect(windows()).toHaveLength(0);
    });
  });

  it('hides a pinned preview while another tab covers its map, and shows it with the map', () => {
    hoverToken(eventBus);
    const [preview] = windows();
    buttonsOf(preview!)[0]!.click();

    mapShown = false;
    workspaceEvents.get('active-leaf-change')?.({ view: { getViewType: (): string => 'markdown' } });
    expect(preview!.style.display).toBe('none');

    mapShown = true;
    workspaceEvents.get('active-leaf-change')?.(mapLeaf);
    expect(preview!.style.display).toBe('');
    expect(windows()).toEqual([preview]);
  });

  it('has no controls on a preview from a list, which only lives while Mod is held', () => {
    act(() => { new StatblockPreviewWindow({} as never, NOTE_PATH, { id: 'token-1', name: 'Goblin' }, null, { x: 0, y: 0 }); });
    const [preview] = windows();
    expect(preview!.querySelector('.atlas-statblock-preview-window__controls')).toBeNull();
  });
});
