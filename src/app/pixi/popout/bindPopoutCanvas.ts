import { Ticker, type Application } from 'pixi.js';
import { followWindow } from '../../utils/followWindow';
import { pumpTickers } from './popoutFramePump';
import { pumpMotion } from './popoutMotionPump';
import { bridgePopoutPointer } from './popoutPointerBridge';

/**
 * Makes `app`'s map work in whichever window `containerEl` is in. PIXI listens for pointer moves
 * and releases, and asks for frames, on the main window only; in a popout the canvas' own window
 * hands both on (`bridgePopoutPointer`, `pumpTickers`): the app's ticker, the shared one, on
 * which the map image loads its tiles, and PIXI's system ticker (its scheduled work, such as texture
 * garbage collection, and the hover under a still pointer). Motion's animations of the map's UI are
 * stepped there too while the main window is hidden (`pumpMotion`). In the main window PIXI needs nothing.
 *
 * @returns Stops following the container's window.
 */
export function bindPopoutCanvas(app: Application, containerEl: HTMLElement): () => void {
  return followWindow(containerEl, (win: Window): (() => void) => {
    if (win === window) return (): void => undefined;
    const stopPointer = bridgePopoutPointer(app.renderer.events, win);
    const stopPump = pumpTickers(win, [app.ticker, Ticker.shared, Ticker.system]);
    const stopMotion = pumpMotion(win);
    return (): void => {
      stopPointer();
      stopPump();
      stopMotion();
    };
  });
}
