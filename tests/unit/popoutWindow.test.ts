// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventSystem } from 'pixi.js';
import { followResize, followWindow } from '../../src/app/utils/followWindow';
import { bridgePopoutPointer } from '../../src/app/pixi/popout/popoutPointerBridge';
import { stepStalledTickers, type PumpedTicker } from '../../src/app/pixi/popout/popoutFramePump';
import { stepStalledMotion } from '../../src/app/pixi/popout/popoutMotionPump';
import { frameData as framerFrameData } from 'framer-motion';
import { frameData, type FrameData, type StepId, type Steps } from 'motion-dom';
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

  it("moves PIXI's move and release listeners to the popout, and back when stopped", () => {
    const win = popout();
    const events = { _onPointerMove: vi.fn(), _onPointerUp: vi.fn(), domElement: document.createElement('canvas') };
    // As PIXI's `_addEvents` binds them on the main window
    document.addEventListener('pointermove', events._onPointerMove, true);
    window.addEventListener('pointerup', events._onPointerUp, true);
    const moveIn = (target: Window): void => {
      target.document.dispatchEvent(new target.MouseEvent('pointermove'));
      target.dispatchEvent(new target.MouseEvent('pointerup'));
    };

    const stop = bridgePopoutPointer(events as unknown as EventSystem, win);
    moveIn(window);
    expect(events._onPointerMove).not.toHaveBeenCalled();
    moveIn(win);
    expect(events._onPointerMove).toHaveBeenCalledTimes(1);
    expect(events._onPointerUp).toHaveBeenCalledTimes(1);

    stop();
    moveIn(win);
    moveIn(window);
    expect(events._onPointerMove).toHaveBeenCalledTimes(2);
    expect(events._onPointerUp).toHaveBeenCalledTimes(2);
    document.removeEventListener('pointermove', events._onPointerMove, true);
    window.removeEventListener('pointerup', events._onPointerUp, true);
  });

  it('leaves the main window alone when PIXI let go of its listeners meanwhile', () => {
    const events = { _onPointerMove: vi.fn(), _onPointerUp: vi.fn(), domElement: document.createElement('canvas') as HTMLCanvasElement | null };
    const stop = bridgePopoutPointer(events as unknown as EventSystem, popout());
    events.domElement = null;
    stop();
    document.dispatchEvent(new MouseEvent('pointermove'));
    expect(events._onPointerMove).not.toHaveBeenCalled();
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

/** A ResizeObserver for `win` that records what it observes, as each window has its own. */
function recordingObserver(win: Window): { observed: Element[]; disconnected: () => boolean } {
  const observed: Element[] = [];
  let disconnected = false;
  Object.defineProperty(win, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe(target: Element): void { observed.push(target); }
      unobserve(): void {}
      disconnect(): void { disconnected = true; }
    },
  });
  return { observed, disconnected: () => disconnected };
}

describe('followResize', () => {
  it("measures with the observer of the window the element is in now, the popout's once the tab moved there", () => {
    const other = popout();
    const main = recordingObserver(window);
    const inPopout = recordingObserver(other);
    const { el, moveTo } = movableElement(window);
    document.body.appendChild(el);
    const stop = followResize(el, vi.fn());
    expect(main.observed).toEqual([el]);

    // A main window that a maximised popout covers reports no sizes: the popout's own observer must
    other.document.body.appendChild(el);
    moveTo(other);
    expect(main.disconnected()).toBe(true);
    expect(inPopout.observed).toEqual([el]);

    stop();
    expect(inPopout.disconnected()).toBe(true);
    delete (window as { ResizeObserver?: unknown }).ResizeObserver;
  });
});

describe('stepStalledMotion', () => {
  const ORDER: StepId[] = ['read', 'resolveKeyframes', 'update', 'preRender', 'render', 'postRender'];
  const steps = (ran: string[]): Steps => Object.fromEntries(ORDER.map((id) => [id, {
    schedule: vi.fn(), cancel: vi.fn(), process: (data: FrameData) => { ran.push(`${id}@${data.timestamp}:${data.isProcessing}`); },
  }])) as unknown as Steps;

  it("pumps framer-motion's own frame loop", () => {
    expect(framerFrameData).toBe(frameData);
  });

  it('runs a frame of every step in order when Motion ran none since the previous frame, as under a covered main window', () => {
    const ran: string[] = [];
    const data: FrameData = { timestamp: 90, delta: 16, isProcessing: false };
    stepStalledMotion(steps(ran), data, 100, 116);
    expect(ran).toEqual(ORDER.map((id) => `${id}@116:true`));
    expect(data).toEqual({ timestamp: 116, delta: 26, isProcessing: false });
  });

  it('leaves a frame Motion ran itself since, and one it is running', () => {
    const ran: string[] = [];
    stepStalledMotion(steps(ran), { timestamp: 110, delta: 16, isProcessing: false }, 100, 116);
    stepStalledMotion(steps(ran), { timestamp: 90, delta: 16, isProcessing: true }, 100, 116);
    expect(ran).toEqual([]);
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
