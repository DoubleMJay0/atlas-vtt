import React, { useState } from 'react';
import { t } from '../../../../i18n';
import {
  addedCounterRow, changedCounterRow, movedCounterRow, removedCounterRow,
} from '../../../model/counterPresets';
import type { CounterPreset, TemplateBlock } from '../../../model/templateTypes';
import { useTemplateEditor } from '../editorContext';
import { boundFieldOf, editField } from '../inspector/blockEdits';
import { Setting, SettingNote } from '../inspector/InspectorControls';
import type { EditorSession } from '../sessionTypes';
import { CounterRowSetting } from './CounterRowSetting';

interface CountersOptionsProps {
  block: TemplateBlock;
  session: EditorSession;
  readOnly: boolean;
}

/**
 * A Counters tile's Options: the rows every statblock of the template starts
 * with (spell levels, ki, a feature's uses), each with its uses and the rest
 * that refills it, added, changed, moved and removed one step at a time. A
 * statblock keeps its own rows once it holds some.
 */
export function CountersOptions({ block, session, readOnly }: CountersOptionsProps): React.JSX.Element | null {
  const { snapshot } = useTemplateEditor();
  const [name, setName] = useState('');
  const field = boundFieldOf(snapshot.template, block);
  if (block.type !== 'counters') return null;
  if (!field) return <SettingNote>{t('statblock.countersNameFirst')}</SettingNote>;
  const rows = field.counterRows ?? [];
  const edit = (change: (rows: readonly CounterPreset[]) => CounterPreset[]): void => {
    const now = boundFieldOf(session.getSnapshot().template, block)?.counterRows ?? [];
    const next = change(now);
    editField(session, field.key, { counterRows: next.length > 0 ? next : undefined });
  };
  const add = (): void => {
    const label = name.trim();
    if (!label) return;
    setName('');
    edit((current) => addedCounterRow(current, label));
  };
  return (
    <Setting label={t('statblock.counterRows')} wide>
      {(labelId) => (
        <div className="atlas-te-setting__list">
          {rows.map((row, index) => (
            <CounterRowSetting
              // A row is told apart by its place: names may repeat, and the inputs follow the place.
              key={index}
              row={row}
              index={index}
              count={rows.length}
              session={session}
              disabled={readOnly}
              onEdit={(change) => edit((current) => changedCounterRow(current, index, change))}
              onMove={(to) => edit((current) => movedCounterRow(current, index, to))}
              onRemove={() => edit((current) => removedCounterRow(current, index))}
            />
          ))}
          <input
            type="text"
            className="atlas-te-input"
            aria-labelledby={labelId}
            placeholder={t('statblock.counterAdd')}
            disabled={readOnly}
            value={name}
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
            onBlur={add}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
              event.preventDefault();
              add();
            }}
          />
        </div>
      )}
    </Setting>
  );
}
