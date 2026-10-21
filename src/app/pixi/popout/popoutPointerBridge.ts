import type { EventSystem } from 'pixi.js';

/** The handlers PIXI's EventSystem binds in its constructor for the pointer moves and releases it hears. */
interface GlobalPointerHandlers {
  _onPointerMove(event: PointerEvent): void;
  _onPointerUp(event: PointerEvent): void;
}

/**
 * PIXI's EventSystem hears pointer moves on `globalThis.document` and releases on `globalThis`
 * (PixiJS 8.22, `_addEvents`), so a canvas in a popout window got its presses and nothing after
 * them: no drag, pan or stroke moved or ended. This hands the moves and releases of `win`, the
 * canvas' own window, to the same handlers, as PIXI listens for them: in the capture phase.
 *
 * @returns Stops handing them on.
 */
export function bridgePopoutPointer(events: EventSystem, win: Window): () => void {
  const handlers = events as unknown as GlobalPointerHandlers;
  const move = (event: PointerEvent): void => handlers._onPointerMove(event);
  const up = (event: PointerEvent): void => handlers._onPointerUp(event);
  win.document.addEventListener('pointermove', move, true);
  win.addEventListener('pointerup', up, true);
  return (): void => {
    win.document.removeEventListener('pointermove', move, true);
    win.removeEventListener('pointerup', up, true);
  };
}
