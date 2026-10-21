import { MarkdownView, type App } from 'obsidian';
import { measureNoteRoom } from './noteRoom';
import { FALLBACK_PANEL_WIDTH } from './paneCardWidth';
import { loadPanelPrefs, panelWidth } from './panelPrefs';
import { panelPrefsSource } from './panelPrefsSource';

/** The note view shown last that has a size: the most recent leaf's, else any shown one. */
function shownNoteView(app: App): MarkdownView | null {
  const views = [app.workspace.getMostRecentLeaf(), ...app.workspace.getLeavesOfType('markdown')]
    .map((leaf) => leaf?.view)
    .filter((view): view is MarkdownView => view instanceof MarkdownView && view.contentEl.clientWidth > 0);
  return views[0] ?? null;
}

/**
 * The width a statblock panel beside a note has on this device now: the width the user chose by
 * dragging its edge, else the default of the note view shown last, else a width that holds a
 * one-column card whole. What the card is laid out at elsewhere, so it reads as the GM sees it.
 */
export function panelWidthNow(app: App): number {
  const prefs = panelPrefsSource(app)?.panelPrefs() ?? loadPanelPrefs(app);
  const view = shownNoteView(app);
  if (view) return panelWidth(prefs, measureNoteRoom(view));
  return prefs.width ?? FALLBACK_PANEL_WIDTH;
}
