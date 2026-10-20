import React from 'react';
import { updateField } from '../../../model/fieldOps';
import type { FieldTracking, MetricBlock, StatblockTemplate, TemplateField } from '../../../model/templateTypes';
import { trackedNumbers } from '../../../values/trackedNumbers';
import { SelectSetting, SettingNote } from '../inspector/InspectorControls';
import type { EditorSession } from '../sessionTypes';

type Tracking = 'off' | FieldTracking['counts'];

const TRACKING: ReadonlyArray<{ value: Tracking; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'down', label: 'Counts down' },
  { value: 'up', label: 'Counts up' },
];

/** The maximum is the number's own value. */
const OWN = '';

interface TrackedSettingProps {
  field: TemplateField;
  template: StatblockTemplate;
  session: EditorSession;
  readOnly: boolean;
  /** Names the settings after the number, where a tile holds several (a Metric). */
  named?: boolean;
}

/**
 * Whether a number is tracked (Luck, Ki, Hit Dice): spent and got back by its character, with the
 * note's value as its maximum, or another number's (Hit Dice up to Level). A recovery button can
 * restore it, and its player steps it on their sheet. One step each.
 */
export function TrackedSetting({ field, template, session, readOnly, named = false }: TrackedSettingProps): React.JSX.Element {
  const tracks = field.tracks;
  const name = field.label.trim() || field.key;
  // A Track tile bound to no resource tracks its number already
  if (!tracks && trackedNumbers(template).some((number) => number.field.key === field.key)) {
    return <SettingNote>{named ? `${name} is tracked by its Track tile.` : 'Tracked by its Track tile.'}</SettingNote>;
  }
  const set = (next: FieldTracking | undefined): void => session.apply((now) => updateField(now, field.key, { tracks: next }));
  const others = template.fields.filter((other) => other.type === 'number' && other.key !== field.key);
  return (
    <>
      <SelectSetting<Tracking>
        label={named ? `${name} tracked` : 'Tracked'}
        value={tracks?.counts ?? 'off'}
        options={[...TRACKING]}
        disabled={readOnly}
        onChange={(counts) => set(counts === 'off' ? undefined : { ...tracks, counts })}
      />
      {tracks && (
        <SelectSetting<string>
          label={named ? `${name} maximum` : 'Maximum'}
          value={tracks.max ?? OWN}
          options={[{ value: OWN, label: 'This value' }, ...others.map((other) => ({ value: other.key, label: other.label.trim() || other.key }))]}
          disabled={readOnly}
          onChange={(max) => set(max === OWN ? { counts: tracks.counts } : { ...tracks, max })}
        />
      )}
    </>
  );
}

interface MetricTrackedSettingsProps {
  block: MetricBlock;
  template: StatblockTemplate;
  session: EditorSession;
  readOnly: boolean;
}

/** A Metric's numbers, each tracked or not on its own. */
export function MetricTrackedSettings({ block, template, session, readOnly }: MetricTrackedSettingsProps): React.JSX.Element {
  const numbers = block.fields.flatMap((key) => template.fields.filter((field) => field.key === key && field.type === 'number'));
  return (
    <>
      {numbers.map((field) => <TrackedSetting key={field.key} field={field} template={template} session={session} readOnly={readOnly} named={numbers.length > 1} />)}
    </>
  );
}
