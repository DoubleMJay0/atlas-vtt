// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventSystem } from 'pixi.js';
import { followWindow } from '../../src/app/utils/followWindow';
import { bridgePopoutPointer } from '../../src/app/pixi/popout/popoutPointerBridge';
import { stepStalledTickers, type PumpedTicker } from '../../src/app/pixi/popout/popoutFramePump';
import { isActiveAtlasLeaf } from '../../src/app/utils/activeLeafGuard';

/** A second window, as a popout is one: jsdom gives an iframe a window and document of its own. */
function popout(): Window {
  const frame = document.body.createEl('iframe');
  return frame.contentWindow!;
}

/** An element whose window Obsidian can move, as `onWindowMigrated` reports it. */
function movableElement(win: Window): { el: HTMLElement; moveTo: (next: Window) => void } {
  let current = win;
  const listeners: Array<(next: Window) => void> = [];
  const el = document.createElement('div');
  Object.defineProperty(el, 'win', { get: () => current });
  el.onWindowMigrated = (listener: (next: Window) => unknown): (() => void) => {
    const call = (next: Window): void => void listener(next);
    listeners.push(call);
    return () => listeners.splice(listeners.indexOf(call), 1);
  };
  return { el, moveTo: (next) => { current = next; listeners.forEach((listener) => listener(next)); } };
}

afterEach(() => {
  document.body.empty();
  vi.unstubAllGlobals();
});

describe('followWindow', () => {
  it('binds to the window the element is in, and to the new one when it moves', () => {
    const other = popout();
    const { el, moveTo } = movableElement(window);
    const bound: Window[] = [];
    const unbound: Window[] = [];
    const stop = followWindow(el, (win) => {
      bound.push(win);
      return () => unbound.push(win);
    });
    moveTo(other);
    expect(bound).toEqual([window, other]);
    expect(unbound).toEqual([window]);

    stop();
    moveTo(window);
    expect(unbound).toEqual([window, other]);
    expect(bound).toHaveLength(2);
  });
});

describe('bridgePopoutPointer', () => {
  it('relies on handlers PIXI still has', () => {
    const prototype = EventSystem.prototype as unknown as Record<string, unknown>;
    expect(typeof prototype._onPointerMove).toBe('function');
    expect(typeof prototype._onPointerUp).toBe('function');
  });

  it("hands the popout's pointer moves and releases to PIXI until stopped", () => {
    const win = popout();
    const handlers = { _onPointerMove: vi.fn(), _onPointerUp: vi.fn() };
    const stop = bridgePopoutPointer(handlers as unknown as EventSystem, win);
    win.document.dispatchEvent(new win.MouseEvent('pointermove'));
    win.dispatchEvent(new win.MouseEvent('pointerup'));
    expect(handlers._onPointerMove).toHaveBeenCalledTimes(1);
    expect(handlers._onPointerUp).toHaveBeenCalledTimes(1);

    stop();
    win.document.dispatchEvent(new win.MouseEvent('pointermove'));
    win.dispatchEvent(new win.MouseEvent('pointerup'));
    expect(handlers._onPointerMove).toHaveBeenCalledTimes(1);
    expect(handlers._onPointerUp).toHaveBeenCalledTimes(1);
  });
});

describe('stepStalledTickers', () => {
  const ticker = (lastTime: number, started = true): PumpedTicker & { update: ReturnType<typeof vi.fn> } => ({
    started, lastTime, update: vi.fn(),
  });

  it('steps a ticker that has not run since the previous frame, as under a covered main window', () => {
    const stalled = ticker(100);
    expect(stepStalledTickers([stalled], 100, 116)).toBe(116);
    expect(stalled.update).toHaveBeenCalledWith(116);
  });

  it('leaves a ticker that its own loop stepped since, and one that is stopped', () => {
    const running = ticker(110);
    const stopped = ticker(50, false);
    stepStalledTickers([running, stopped], 100, 116);
    expect(running.update).not.toHaveBeenCalled();
    expect(stopped.update).not.toHaveBeenCalled();
  });
});

describe('isActiveAtlasLeaf', () => {
  it('finds the active leaf in the focused popout', () => {
    const doc = popout().document;
    doc.body.innerHTML = '<div class="workspace-leaf mod-active"><div data-view-id="map"></div></div>';
    vi.stubGlobal('activeDocument', doc);
    expect(isActiveAtlasLeaf('map')).toBe(true);
  });
});
