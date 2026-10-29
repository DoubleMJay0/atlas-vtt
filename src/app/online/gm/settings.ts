import type { Setting } from 'obsidian';
import type { AtlasSettingSection } from '../../settings/settingSections';
import type { AccountControl } from './account/AccountControl.ts';
import { accountSections } from './account/accountSettings.ts';
import { COMPANION_REPORTS_NOTE } from './companionReports.ts';
import { t } from '../../i18n';

export interface OnlineSettings {
  /** Whether this plugin's errors are reported to the server; off until the GM switches it on. */
  reportErrors: boolean;
  /** Whether signing out removes every copy the store keeps for the players; off until the GM switches it on. */
  deleteCopiesOnSignOut: boolean;
}

export const DEFAULT_SETTINGS: OnlineSettings = { reportErrors: false, deleteCopiesOnSignOut: false };

/** Settings read from the plugin's data, each field checked. */
export function readSettings(data: unknown): OnlineSettings {
  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  return { reportErrors: record.reportErrors === true, deleteCopiesOnSignOut: record.deleteCopiesOnSignOut === true };
}

/** What online play's settings rows read and change. */
export interface OnlineSettingsHost {
  readonly settings: OnlineSettings;
  readonly account: AccountControl;
  saveSettings(): Promise<void>;
}

/** Online play's sections of Atlas's settings: the account and error reports. */
export function onlineSettingsSections(host: OnlineSettingsHost): AtlasSettingSection[] {
  const save = async (change: (settings: OnlineSettings) => void): Promise<void> => {
    change(host.settings);
    await host.saveSettings();
  };
  const settings = host.settings;
  const copies = {
    name: t('online.deleteOnSignOut'),
    desc: t('online.deleteOnSignOutDesc'),
    render: (setting: Setting) => {
      setting.addToggle((toggle) => toggle.setValue(settings.deleteCopiesOnSignOut).onChange((value) => void save((current) => (current.deleteCopiesOnSignOut = value))));
    },
  };
  return [
    ...accountSections(host.account, [copies]),
    {
      heading: 'Online diagnostics',
      rows: [{
        name: 'Send error reports',
        desc: COMPANION_REPORTS_NOTE,
        render: (setting) => {
          setting.addToggle((toggle) => toggle.setValue(settings.reportErrors).onChange((value) => void save((current) => (current.reportErrors = value))));
        },
      }],
    },
  ];
}
