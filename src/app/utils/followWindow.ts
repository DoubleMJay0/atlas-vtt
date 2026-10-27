import { observeResize } from './observeResize';

/**
 * Runs `bind` for the window `el` lives in, and again for the new one whenever Obsidian moves `el`
 * to another window (a tab dragged into a popout, or back), after undoing the previous binding.
 * Listeners on a window only hear that window, so whatever listens for a view must follow it.
 *
 * @returns Undoes the current binding and stops following.
 */
export function followWindow(el: HTMLElement, bind: (win: Window) => () => void): () => void {
  let unbind = bind(el.win);
  const stopFollowing = el.onWindowMigrated((win: Window): void => {
    unbind();
    unbind = bind(win);
  });
  return (): void => {
    stopFollowing();
    unbind();
  };
}

/**
 * `observeResize` for an element Obsidian may move to another window (a tab dragged into a
 * popout, or back): the observer is always the one of the window `el` is in now. A window
 * reports sizes only while it draws, and one a maximised popout covers is hidden and draws
 * nothing, so an observer of the main window never told a map in that popout its new size.
 */
export function followResize(el: HTMLElement, onResize: () => void): () => void {
  return followWindow(el, () => observeResize([el], onResize));
}
