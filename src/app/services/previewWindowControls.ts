import { setIcon } from 'obsidian';
import { t } from '../i18n';

/**
 * The pin button of a floating preview window (note and statblock previews):
 * a pinned window stays open when the Mod key is released or the pointer leaves its anchor.
 */
export function createPinButton(parent: HTMLElement, className: string, onToggle: () => void): HTMLButtonElement {
  const button = parent.createEl('button', { cls: className });
  button.type = 'button';
  button.onclick = onToggle;
  showPinState(button, false);
  return button;
}

/** Shows whether the window is pinned: the icon, its accessible name and the `is-pinned` class. */
export function showPinState(button: HTMLButtonElement, pinned: boolean): void {
  button.empty();
  setIcon(button, pinned ? 'pin-off' : 'pin');
  button.setAttribute('aria-label', pinned ? t('preview.unpin') : t('preview.pin'));
  button.classList.toggle('is-pinned', pinned);
}

/**
 * Moves a floating preview window with the pointer, from a press on its handle
 * until the button is released, then calls `onEnd`. Presses on a button inside
 * the handle are left to the button. Returns a function that stops a drag
 * still under way, for a window closed meanwhile; it does nothing otherwise.
 */
export function startPreviewWindowDrag(element: HTMLElement, event: MouseEvent, onEnd: () => void): () => void {
  if ((event.target as HTMLElement | null)?.closest('button')) return () => {};
  const doc = element.ownerDocument;
  const startX = event.clientX;
  const startY = event.clientY;
  const startLeft = element.offsetLeft;
  const startTop = element.offsetTop;
  element.classList.add('is-dragging');

  const move = (e: MouseEvent): void => {
    element.style.left = `${startLeft + e.clientX - startX}px`;
    element.style.top = `${startTop + e.clientY - startY}px`;
  };
  const stop = (): void => {
    element.classList.remove('is-dragging');
    doc.removeEventListener('mousemove', move);
    doc.removeEventListener('mouseup', end);
  };
  const end = (): void => {
    stop();
    onEnd();
  };
  doc.addEventListener('mousemove', move);
  doc.addEventListener('mouseup', end);
  return stop;
}
