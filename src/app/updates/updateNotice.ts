import { ATLAS_GITHUB_URL } from '../support/communityLinks';
import { t } from '../i18n';
import { showNotice } from '../ui/notice';

/** Obsidian's page of Atlas, which reads the published manifest afresh and offers Update at once. */
const PLUGIN_PAGE_URL = 'obsidian://show-plugin?id=atlas-vtt';

export function releaseNotesUrl(version: string): string {
  return `${ATLAS_GITHUB_URL}/releases/tag/${encodeURIComponent(version)}`;
}

/** Hands the update to Obsidian: Atlas never installs anything itself. */
export function openUpdate(): void {
  window.open(PLUGIN_PAGE_URL);
}

/** Says that `version` is out, with Update and What's new; it stays until it is clicked. */
export function announceUpdate(version: string): void {
  const message = createFragment();
  message.append(`${t('settings.updates.notice', { version })} `);
  const update = createEl('a', { text: t('settings.updates.update'), href: '#' });
  const notes = createEl('a', { text: t('settings.updates.whatsNew'), href: '#' });
  message.append(update, ' · ', notes);
  const notice = showNotice(message, 0);
  update.addEventListener('click', (event) => {
    event.preventDefault();
    notice.hide();
    openUpdate();
  });
  notes.addEventListener('click', (event) => {
    event.preventDefault();
    notice.hide();
    window.open(releaseNotesUrl(version));
  });
}
