import { t } from '../../../i18n';
import { textButton } from './controls.ts';
import { confirmPrompt, openPrompt } from './prompts.ts';

export interface SharedRowActions {
  /** Removes every copy the store keeps for the players. */
  removeShared(): void;
}

/**
 * What the store keeps for the players, of the account's quota and when the oldest copy leaves, with
 * the way to remove every copy now (asked first). No line while nothing can be told.
 */
export function renderSharedRow(layer: HTMLElement, text: string | null, actions: SharedRowActions, redraw: () => void): void {
  if (text === null) return;
  const row = layer.createDiv({ cls: 'atlas-online-shared' });
  row.createSpan({ cls: 'atlas-online-shared__text', text, attr: { role: 'status' } });
  const ask = (): void => openPrompt(layer, confirmPrompt('remove-shared', t('online.removeSharedTitle'), t('online.removeSharedQuestion'), t('online.removeSharedAction'), () => actions.removeShared(), { warning: true }), redraw);
  textButton(row, t('online.removeShared'), ask, 'ghost').dataset.focusKey = 'remove-shared';
}
