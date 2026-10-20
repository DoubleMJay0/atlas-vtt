import type { ContextMenuEntry } from '../root/ContextMenuContext';
import { MENU_SEPARATOR } from './context-menu/AtlasContextMenu';
import { confirmAction } from '../../ui/confirmDialog';
import { runInBackground } from '../../utils/backgroundTask';
import { t } from '../../i18n';

interface TrackerOptionsState {
  autoSort: boolean;
  /** By sides nothing is sorted: the switch stays in place, disabled. */
  bySides: boolean;
  /** The tracker holds no combatant: there is nothing to clear. */
  empty: boolean;
}

interface TrackerOptionsActions {
  setAutoSort: (autoSort: boolean) => void;
  clear: () => void;
}

/**
 * Asks before the tracker is emptied: initiative is no undo step, so a cleared fight cannot be
 * brought back. An empty tracker is cleared without a question.
 */
export async function clearInitiativeAsking(empty: boolean, clear: () => void): Promise<void> {
  if (!empty) {
    const confirmed = await confirmAction({
      title: t('initiative.clearTitle'),
      message: [t('initiative.clearBody')],
      confirmLabel: t('initiative.clear'),
      destructive: true,
    });
    if (!confirmed) return;
  }
  clear();
}

/** The menu behind the tracker's options button: how it sorts, and clearing it. */
export function initiativeTrackerOptions(state: TrackerOptionsState, actions: TrackerOptionsActions): ContextMenuEntry[] {
  return [
    {
      type: 'item',
      label: t('initiative.autoSort'),
      icon: 'arrow-down-wide-narrow',
      checked: state.autoSort,
      disabled: state.bySides,
      description: t('initiative.autoSortHint'),
      onClick: () => actions.setAutoSort(!state.autoSort),
    },
    MENU_SEPARATOR,
    {
      type: 'item',
      label: t('initiative.clear'),
      icon: 'trash-2',
      destructive: true,
      disabled: state.empty,
      onClick: () => runInBackground(clearInitiativeAsking(state.empty, actions.clear), 'Clearing initiative'),
    },
  ];
}
