import React from 'react';
import { SegmentedControl } from '../../primitives/SegmentedControl';
import { t } from '../../../../i18n';

export type MapSource = 'import' | 'generate';

interface MapSourceSwitchProps {
  value: MapSource;
  onChange: (source: MapSource) => void;
  disabled: boolean;
}

/** Whether the map creator adds maps from files or generates a dungeon. */
export function MapSourceSwitch({ value, onChange, disabled }: MapSourceSwitchProps): React.JSX.Element {
  return (
    <SegmentedControl<MapSource>
      className="atlas-token-creator__source-switch"
      value={value}
      roving
      disabled={disabled}
      ariaLabel={t('dungeon.mode.label')}
      options={[
        { value: 'import', label: t('dungeon.mode.import') },
        { value: 'generate', label: t('dungeon.mode.generate') },
      ]}
      onChange={onChange}
    />
  );
}
