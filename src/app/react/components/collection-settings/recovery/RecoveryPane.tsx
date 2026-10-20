import React, { useId, useState } from 'react';
import { t } from '../../../../i18n';
import { templateButtons, withTemplateButtons } from '../../../../recovery/editor/recoveryEdits';
import type { RecoveryTemplateTab } from '../../../../recovery/editor/recoveryTemplateTabs';
import type { RecoveryRecord } from '../../../../recovery/recoveryTypes';
import type { ResourceDefinition } from '../../../../resources/resourceTypes';
import type { StatblockTemplate, TemplateId } from '../../../../statblocks/model/templateTypes';
import { TabPanel, TabStrip } from '../../../../statblocks/render/tabs/TabStrip';
import type { ConditionDefinition } from '../../../../types/collectionSettingsTypes';
import { RecoveryEditor } from './RecoveryEditor';

/** A template a tab draws, with its name. */
export interface RecoveryTemplate {
  template: StatblockTemplate;
  name: string;
}

export interface RecoveryPaneProps {
  tabs: readonly RecoveryTemplateTab[];
  templates: ReadonlyMap<TemplateId, RecoveryTemplate>;
  resources: readonly ResourceDefinition[];
  conditions: readonly ConditionDefinition[];
  /** Every template's buttons as the collection reads them. */
  record: RecoveryRecord;
  onChange: (record: RecoveryRecord) => void;
}

/**
 * The recovery buttons of a collection, beside the token's sockets in the Resources tab: a tab
 * per statblock template, and for the open one its buttons over its card.
 */
export function RecoveryPane({ tabs, templates, resources, conditions, record, onChange }: RecoveryPaneProps): React.ReactElement {
  const idBase = useId();
  const headingId = useId();
  const [open, setOpen] = useState<TemplateId | null>(null);
  const tab = tabs.find((each) => each.templateId === open) ?? tabs[0];
  const shown = tab ? templates.get(tab.templateId) : undefined;

  return (
    <section className="atlas-rc-pane" aria-labelledby={headingId}>
      <header className="atlas-rc-pane__head">
        <h4 id={headingId} className="atlas-rc-pane__title">{t('recoveryEditor.title')}</h4>
        <p className="atlas-csm-hint">{t('recoveryEditor.hint')}</p>
      </header>
      {tab && shown ? (
        <>
          <div className="atlas-rc-templates">
            <TabStrip idBase={idBase} label={t('recoveryEditor.templates')} selected={tab.templateId} onSelect={setOpen}
              tabs={tabs.map(({ templateId, label }) => ({ id: templateId, label }))} />
          </div>
          <TabPanel idBase={idBase} tab={tab.templateId} open>
            <RecoveryEditor
              key={tab.templateId}
              template={shown.template}
              name={shown.name}
              buttons={templateButtons(record, tab.templateId)}
              onButtonsChange={(buttons) => onChange(withTemplateButtons(record, tab.templateId, buttons))}
              resources={resources}
              conditions={conditions}
            />
          </TabPanel>
        </>
      ) : (
        <p className="atlas-rc-pane__empty">{t('recoveryEditor.noTemplates')}</p>
      )}
    </section>
  );
}
