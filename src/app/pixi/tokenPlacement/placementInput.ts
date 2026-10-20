import { Point as PixiPoint, type Application, type FederatedPointerEvent } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { watchClick } from '../utils/clickRelease';
import { setCanvasCursor } from '../utils/canvasCursor';
import { canRunMapHotkeys, matchesMapHotkey } from '../../keyboard/mapHotkeys';
import type { SettingsService } from '../../services/SettingsService';
import type { PlacementSession } from './PlacementSession';
import type { Point } from './placementLayout';

export interface PlacementInputDeps {
  app: Application;
  viewport: Viewport;
  canvas: HTMLCanvasElement;
  viewId: string;
  settings(): SettingsService | undefined;
}

/** How long after a placement a double click on the map is still taken as part of it, in ms. */
const DOUBLE_CLICK_GUARD_MS = 500;

/**
 * Hands the pointer and keys to `session` while it lasts; returns the function that gives them back.
 * A left press on the map is the session's alone: it is taken before PIXI sees it, so no tool,
 * token or marquee answers it. A right-drag still pans and a right click in place puts the tokens
 * away, as Escape does. Shift is read from every pointer and key event and dropped when the window
 * loses focus. The system cursor is hidden over the map: the held tokens are the cursor.
 */
export function bindPlacementInput(deps: PlacementInputDeps, session: PlacementSession): () => void {
  const { app, viewport, canvas } = deps;
  const host = canvas.parentElement ?? canvas;
  const win = canvas.ownerDocument.defaultView ?? window;
  let stopRightClick: (() => void) | null = null;

  const screenOf = (event: { clientX: number; clientY: number }): Point => {
    const point = new PixiPoint();
    app.renderer.events.mapPositionToPoint(point, event.clientX, event.clientY);
    return { x: point.x, y: point.y };
  };

  const onMove = (event: FederatedPointerEvent): void => {
    session.moveTo({ x: event.global.x, y: event.global.y }, event.shiftKey);
    // After PIXI's own cursor write for this event
    queueMicrotask(() => { if (session.active) setCanvasCursor(canvas, 'none'); });
  };
  const onPress = (event: PointerEvent): void => {
    if (event.target !== canvas || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    session.put(screenOf(event), event.shiftKey);
  };
  const onDoubleClick = (event: MouseEvent): void => {
    if (event.target !== canvas) return;
    event.stopPropagation();
    event.preventDefault();
  };
  const onRightPress = (event: FederatedPointerEvent): void => {
    if (event.button !== 2) return;
    stopRightClick?.();
    stopRightClick = watchClick(viewport, event, () => session.cancel());
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Shift') session.setShift(event.type === 'keydown');
    else if (event.type === 'keydown' && matchesMapHotkey(event, 'cancel', deps.settings()) && canRunMapHotkeys(event, deps.viewId)) {
      event.preventDefault();
      event.stopPropagation();
      session.cancel();
    }
  };
  const onBlur = (): void => session.setShift(false);
  const onLeave = (): void => session.setOnMap(false);
  const onViewChanged = (): void => session.viewChanged();

  viewport.on('pointermove', onMove);
  viewport.on('pointerdown', onRightPress);
  viewport.on('moved', onViewChanged);
  viewport.on('zoomed', onViewChanged);
  host.addEventListener('pointerdown', onPress, { capture: true });
  host.addEventListener('dblclick', onDoubleClick, { capture: true });
  canvas.addEventListener('pointerleave', onLeave);
  win.addEventListener('keydown', onKey, { capture: true });
  win.addEventListener('keyup', onKey, { capture: true });
  win.addEventListener('blur', onBlur);
  setCanvasCursor(canvas, 'none');

  return (): void => {
    viewport.off('pointermove', onMove);
    viewport.off('pointerdown', onRightPress);
    viewport.off('moved', onViewChanged);
    viewport.off('zoomed', onViewChanged);
    stopRightClick?.();
    host.removeEventListener('pointerdown', onPress, { capture: true });
    canvas.removeEventListener('pointerleave', onLeave);
    win.removeEventListener('keydown', onKey, { capture: true });
    win.removeEventListener('keyup', onKey, { capture: true });
    win.removeEventListener('blur', onBlur);
    setCanvasCursor(canvas, 'default');
    // The second click of a double click that put the last token down must not open it
    win.setTimeout(() => host.removeEventListener('dblclick', onDoubleClick, { capture: true }), DOUBLE_CLICK_GUARD_MS);
  };
}
