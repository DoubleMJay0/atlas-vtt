import React, { useState } from 'react';
import { render } from '@testing-library/react';
import { FIVE_E_2014_MONSTER } from '../../src/app/statblocks/presets/fiveE2014';
import type { RecoveryRecord } from '../../src/app/recovery/recoveryTypes';
import { ADVENTURER, CONDITIONS, RECORD, RESOURCES } from '../fixtures/recoveryFixtures';
import { ResourcesTab } from '../../src/app/react/components/collection-settings/ResourcesTab';
import { SettingsContent } from '../../src/app/react/components/collection-settings/SettingsContent';
import { SettingsDialog } from '../../src/app/react/components/collection-settings/SettingsDialog';
import { RecoveryPane, type RecoveryTemplate } from '../../src/app/react/components/collection-settings/recovery/RecoveryPane';
import type { RecoveryTemplateTab } from '../../src/app/recovery/editor/recoveryTemplateTabs';
import { DASHBOARD_THEME } from './dashboardTheme';

const TABS: RecoveryTemplateTab[] = [
  { templateId: ADVENTURER.id, label: 'Player character' },
  { templateId: FIVE_E_2014_MONSTER.id, label: 'Creature · NPC' },
];
const TEMPLATES = new Map<string, RecoveryTemplate>([
  [ADVENTURER.id, { template: ADVENTURER, name: 'Adventurer' }],
  [FIVE_E_2014_MONSTER.id, { template: FIVE_E_2014_MONSTER.template, name: FIVE_E_2014_MONSTER.name }],
]);

/** Obsidian's buttons, inputs and scrollbars as the plugin meets them. */
export const RECOVERY_THEME = `${DASHBOARD_THEME}
  .atlas-vtt-plugin .atlas-collection-settings-content { scrollbar-width: auto; scrollbar-color: auto; }
`;

/** What the harness hands back: the record after every edit. */
export interface RecoveryHarness {
  record: () => RecoveryRecord;
}

/** The collection settings dialog, fullscreen, on its Resources tab with the recovery pane beside the sockets. */
export function mountRecoveryDialog(theme: 'light' | 'dark', initial: RecoveryRecord = RECORD, onClose: () => void = () => undefined): RecoveryHarness {
  document.body.className = `theme-${theme}`;
  let latest = initial;
  function Dialog(): React.ReactElement {
    const [resources, setResources] = useState(RESOURCES);
    const [record, setRecord] = useState(initial);
    return (
      <SettingsDialog title="Collection Settings: Cairn" closeLabel="Close" canSave onSave={() => undefined} onClose={onClose} size="fullscreen">
        <div className="atlas-collection-settings-body">
          <nav className="atlas-collection-settings-sidebar" />
          <SettingsContent wide>
            <ResourcesTab
              resources={resources}
              onChange={setResources}
              fieldSuggestions={[{ path: 'hp' }, { path: 'stress' }]}
              aside={(
                <RecoveryPane tabs={TABS} templates={TEMPLATES} resources={resources} conditions={CONDITIONS} record={record}
                  onChange={(next) => { latest = next; setRecord(next); }} />
              )}
            />
          </SettingsContent>
        </div>
      </SettingsDialog>
    );
  }
  render(<Dialog />);
  return { record: () => latest };
}
