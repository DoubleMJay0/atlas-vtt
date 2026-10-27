// @vitest-environment jsdom
import { EventEmitter } from 'events';
import { afterEach, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import type { AtlasView } from '../../src/app/atlas-view';
import type { ViewAtlasStore } from '../../src/app/storeFactory';

const react = vi.hoisted(() => ({ mountUI: vi.fn(), unmountUI: vi.fn() }));
vi.mock('../../src/app/react/index', () => react);

const { UIOverlay } = await import('../../src/app/services/UIOverlay');

/** A view's container whose window Obsidian can move, as `onWindowMigrated` reports it. */
function viewContainer(): { el: HTMLElement; moveTo: (win: Window) => void } {
  const listeners: Array<(win: Window) => void> = [];
  const el = document.body.createDiv();
  el.onWindowMigrated = (listener: (win: Window) => unknown): (() => void) => {
    const call = (win: Window): void => void listener(win);
    listeners.push(call);
    return () => listeners.splice(listeners.indexOf(call), 1);
  };
  return {
    el,
    moveTo: (win) => {
      win.document.body.appendChild(el);
      [...listeners].forEach((listener) => listener(win));
    },
  };
}

/** A second window, as a popout is one, with Obsidian's element helpers, which Obsidian gives every popout. */
function popout(): Window {
  const win = document.body.createEl('iframe').contentWindow! as Window & typeof globalThis;
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(Element.prototype))) {
    if (!(name in win.Element.prototype)) Object.defineProperty(win.Element.prototype, name, descriptor);
  }
  return win;
}

afterEach(() => {
  document.body.empty();
  vi.clearAllMocks();
});

it("builds the map's UI again in the window its tab moved to, so menus and dialogs open there", () => {
  const other = popout();
  const { el, moveTo } = viewContainer();
  const overlay = new UIOverlay({} as App, new EventEmitter(), {} as ViewAtlasStore);
  overlay.mount(el, {} as AtlasView, null);
  expect(react.mountUI.mock.calls[0]![1].ownerDocument).toBe(document);

  moveTo(other);
  expect(react.unmountUI).toHaveBeenCalledTimes(1);
  expect(react.mountUI).toHaveBeenCalledTimes(2);
  expect(react.mountUI.mock.calls[1]![1].ownerDocument).toBe(other.document);
  expect(el.querySelectorAll('.atlas-react-ui-container')).toHaveLength(1);

  overlay.unmount();
  moveTo(window);
  expect(react.mountUI).toHaveBeenCalledTimes(2);
});
