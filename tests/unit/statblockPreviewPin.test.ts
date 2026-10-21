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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
    Platform.isMacOS = true;
    const { app } = createInMemoryApp({ files: { [NOTE_PATH]: '# Goblin' } });
    Object.assign(app.workspace, { getLeavesOfType: () => [], on: () => ({}) });
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

  it('follows the token\'s values while it stays open', () => {
    const tokens = (hp: number): object => ({
      'token-1': { id: 'token-1', kind: 'character', name: 'Goblin', x: 0, y: 0, imagePath: '', resources: { hp: { current: hp, max: 7 } } },
    });
    store.setState({ objects: { ...store.getState().objects, tokens: tokens(7) } as never });
    hoverToken(eventBus);
    buttonsOf(windows()[0]!)[0]!.click();

    act(() => { store.setState({ objects: { ...store.getState().objects, tokens: tokens(3) } as never }); });
    const last = statblockProps[statblockProps.length - 1] as { tokens: Array<{ resources: unknown }> };
    expect(last.tokens[0]!.resources).toEqual({ hp: { current: 3, max: 7 } });
  });

  it('has no controls on a preview from a list, which only lives while Mod is held', () => {
    act(() => { new StatblockPreviewWindow({} as never, NOTE_PATH, { id: 'token-1', name: 'Goblin' }, null, { x: 0, y: 0 }); });
    const [preview] = windows();
    expect(preview!.querySelector('.atlas-statblock-preview-window__controls')).toBeNull();
  });
});
