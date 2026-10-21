import { MarkdownView, type App } from 'obsidian';
import { measureNoteRoom } from './noteRoom';
import { FALLBACK_PANEL_WIDTH } from './paneCardWidth';
import { loadPanelPrefs, panelWidth } from './panelPrefs';
import { panelPrefsSource } from './panelPrefsSource';

/**
 * The widest note view of the main area: where the GM reads their notes. A note in a sidebar or a
 * narrow split is passed over, so focusing one never changes the width players' cards are laid out at.
 */
function mainNoteView(app: App): MarkdownView | null {
  const root = app.workspace.rootSplit;
  const views = app.workspace.getLeavesOfType('markdown')
    .filter((leaf) => leaf.getRoot() === root)
    .map((leaf) => leaf.view)
    .filter((view): view is MarkdownView => view instanceof MarkdownView && view.contentEl.clientWidth > 0);
  return views.reduce<MarkdownView | null>((widest, view) => (widest === null || view.contentEl.clientWidth > widest.contentEl.clientWidth ? view : widest), null);
}

/**
 * The width a statblock panel beside a note has on this device: the width the user chose by
 * dragging its edge, else the default, each as the widest note view of the main area gives it room
 * (without one, the chosen width, else a width that holds a one-column card whole). What the card
 * is laid out at elsewhere, so it reads as the GM sees it beside their notes.
 */
export function panelWidthNow(app: App): number {
  const prefs = panelPrefsSource(app)?.panelPrefs() ?? loadPanelPrefs(app);
  const view = mainNoteView(app);
  if (view) return panelWidth(prefs, measureNoteRoom(view));
  return prefs.width ?? FALLBACK_PANEL_WIDTH;
}
