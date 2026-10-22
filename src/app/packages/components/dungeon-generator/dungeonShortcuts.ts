/**
 * The generator's single keys, as the one-page generator GMs know has them: Enter a new dungeon,
 * T the tags, S the style, 1 to 5 the presets, Space arranges the note boxes anew and Shift+Space
 * words the notes anew, N steps through the notes modes and L switches the legend, R
 * rotate-to-fit, H secret rooms, M monochrome,
 * G the grid (Shift+G its style, Shift+1 and Shift+2 the tile size), W water (Shift+W raises
 * it), P props, E saves the page, Shift+E the map, J the JSON.
 */
export type DungeonShortcut =
  | { kind: 'new' }
  | { kind: 'tags' }
  | { kind: 'style' }
  | { kind: 'preset'; index: number }
  | { kind: 'rearrange' }
  | { kind: 'rerollNotes' }
  | { kind: 'cycleNotes' }
  | { kind: 'legend' }
  | { kind: 'rotate' }
  | { kind: 'secrets' }
  | { kind: 'monochrome' }
  | { kind: 'grid' }
  | { kind: 'gridStyle' }
  | { kind: 'smallTiles'; on: boolean }
  | { kind: 'water' }
  | { kind: 'raiseWater' }
  | { kind: 'props' }
  | { kind: 'savePage' }
  | { kind: 'exportMap' }
  | { kind: 'json' };

export type ShortcutKey = Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>;

const PLAIN: Readonly<Record<string, DungeonShortcut>> = {
  enter: { kind: 'new' },
  t: { kind: 'tags' },
  s: { kind: 'style' },
  ' ': { kind: 'rearrange' },
  n: { kind: 'cycleNotes' },
  l: { kind: 'legend' },
  r: { kind: 'rotate' },
  h: { kind: 'secrets' },
  m: { kind: 'monochrome' },
  g: { kind: 'grid' },
  w: { kind: 'water' },
  p: { kind: 'props' },
  e: { kind: 'savePage' },
  j: { kind: 'json' },
};

const SHIFTED: Readonly<Record<string, DungeonShortcut>> = {
  ' ': { kind: 'rerollNotes' },
  g: { kind: 'gridStyle' },
  w: { kind: 'raiseWater' },
  e: { kind: 'exportMap' },
};

/** The keys the shortcuts are registered for: digits come by their code, so Shift+1 is found on any layout. */
export const SHORTCUT_KEYS: readonly string[] = ['Enter', ...Object.keys(PLAIN).filter((key) => key !== 'enter'), '1', '2', '3', '4', '5', '!', '@'];

/** The shortcut a key press asks for, or null. Presses with Mod, Ctrl or Alt are never one. */
export function dungeonShortcutOf(event: ShortcutKey): DungeonShortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const digit = /^Digit([1-5])$/.exec(event.code)?.[1];
  if (digit) {
    if (!event.shiftKey) return { kind: 'preset', index: Number(digit) - 1 };
    if (digit === '1' || digit === '2') return { kind: 'smallTiles', on: digit === '2' };
    return null;
  }
  const key = event.key.toLowerCase();
  return (event.shiftKey ? SHIFTED[key] : PLAIN[key]) ?? null;
}

/** Whether a key pressed in `target` belongs to that control: typing, or a button or menu that takes Enter and Space. */
export function keyBelongsToControl(target: EventTarget | null, key: string): boolean {
  const element = target as Partial<HTMLElement> | null;
  if (!element || typeof element.closest !== 'function') return false;
  if (element.closest('input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], [role="combobox"]')) return true;
  return (key === 'Enter' || key === ' ') && element.closest('button, [role="switch"], [role="radio"], [role="option"], a') !== null;
}
