import { useEffect, useRef } from 'react';
import { Scope, type App } from 'obsidian';
import { dungeonShortcutOf, keyBelongsToControl, SHORTCUT_KEYS, type DungeonShortcut } from './dungeonShortcuts';

/**
 * The generator's keys, in an Obsidian key scope pushed only while focus is inside the panel, so
 * they never reach the map or another view and every other hotkey keeps working. `parent` is the
 * scope that keys the generator does not use go on to: the dialog's own (Escape closes it).
 */
export function useDungeonShortcuts(app: App, root: HTMLElement | null, parent: Scope | null, run: (shortcut: DungeonShortcut) => void): void {
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!root) return undefined;
    const scope = new Scope(parent ?? app.scope);
    for (const key of SHORTCUT_KEYS) {
      scope.register(null, key, (event) => {
        const shortcut = keyBelongsToControl(event.target, event.key) ? null : dungeonShortcutOf(event);
        if (!shortcut) return true;
        runRef.current(shortcut);
        return false;
      });
    }
    let pushed = false;
    const push = (): void => {
      if (pushed) return;
      pushed = true;
      app.keymap.pushScope(scope);
    };
    const pop = (): void => {
      if (!pushed) return;
      pushed = false;
      app.keymap.popScope(scope);
    };
    const doc = root.ownerDocument;
    // A menu or list the panel opened lies outside it in the document; it keeps the scope as it was.
    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target as Node | null;
      if (target && root.contains(target)) push();
      else if (!(target instanceof Element && target.closest('.atlas-ctx-menu, .atlas-select-content, .tooltip-content'))) pop();
    };
    doc.addEventListener('focusin', onFocusIn, true);
    if (doc.activeElement && root.contains(doc.activeElement)) push();
    return () => {
      doc.removeEventListener('focusin', onFocusIn, true);
      pop();
    };
  }, [app, root, parent]);
}
