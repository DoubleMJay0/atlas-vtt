import React from 'react';
import { t } from '../../../../i18n';
import {
  addedRefill, hasRoomForRefill, movedRefill, removedRefill, renamedRefill, withRefillIncluded,
} from '../../../model/counterRefillEdits';
import type { StatblockTemplate } from '../../../model/templateTypes';
import { useTemplateEditor } from '../editorContext';
import { Setting, SettingNote } from '../inspector/InspectorControls';
import type { EditorSession } from '../sessionTypes';
import { AddNameInput } from './AddNameInput';
import { CounterRefillSetting } from './CounterRefillSetting';

interface CounterRefillsSettingProps {
  session: EditorSession;
  readOnly: boolean;
}

/**
 * The refills the template names for its whole sheet ("Short rest", "Dawn", "Session"), shown in
 * every Counters tile's Options beside the rows that name them: each a button beside the note that
 * gives back the uses of every counter on the sheet it refills. Added, renamed, moved and removed,
 * and which others each brings along, one step at a time.
 */
export function CounterRefillsSetting({ session, readOnly }: CounterRefillsSettingProps): React.JSX.Element {
  const { snapshot } = useTemplateEditor();
  const refills = snapshot.template.refills ?? [];
  const names = refills.map((refill) => refill.name);
  /** Changes the template as it is now; a refused edit gives it back unchanged and makes no step. */
  const edit = (change: (template: StatblockTemplate) => StatblockTemplate): void => {
    const now = session.getSnapshot().template;
    if (change(now) !== now) session.apply(change);
  };
  return (
    <>
      <Setting label={t('statblock.counterRefills')} wide>
        {(labelId) => (
          <div className="atlas-te-setting__list">
            {refills.map((refill, index) => (
              <CounterRefillSetting
                // Names are the template's own and unique, but the input follows the place while one is renamed.
                key={index}
                refill={refill}
                index={index}
                names={names}
                session={session}
                disabled={readOnly}
                onRename={(name) => edit((template) => renamedRefill(template, index, name))}
                onInclude={(other, included) => edit((template) => withRefillIncluded(template, index, other, included))}
                onMove={(to) => edit((template) => movedRefill(template, index, to))}
                onRemove={() => edit((template) => removedRefill(template, index))}
              />
            ))}
            <AddNameInput labelledBy={labelId} placeholder={t('statblock.counterRefillAdd')} disabled={readOnly || !hasRoomForRefill(snapshot.template)}
              onAdd={(name) => edit((template) => addedRefill(template, name))} />
          </div>
        )}
      </Setting>
      <SettingNote>{t('statblock.counterRefillsShared')}</SettingNote>
    </>
  );
}
