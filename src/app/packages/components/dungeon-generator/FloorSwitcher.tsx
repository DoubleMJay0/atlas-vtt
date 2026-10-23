import React from 'react';
import { floorLetter } from '../../../dungeons/scene/roomKeys';
import { SegmentedControl, type SegmentedOption } from '../primitives/SegmentedControl';
import { t } from '../../../i18n';

interface FloorSwitcherProps {
  /** How many floors the dungeon has; more than one, or nothing is shown. */
  floors: number;
  floor: number;
  onFloor: (floor: number) => void;
}

/** Which floor the preview shows, by its letter (A the entry floor); only for a dungeon of several. */
export function FloorSwitcher({ floors, floor, onFloor }: FloorSwitcherProps): React.JSX.Element | null {
  if (floors < 2) return null;
  const options: SegmentedOption<string>[] = Array.from({ length: floors }, (_, index) => ({
    value: String(index),
    label: floorLetter(index),
    hint: t('dungeonScene.floor', { letter: floorLetter(index) }),
  }));
  return (
    <SegmentedControl
      className="atlas-dungeon-floor-switcher"
      value={String(floor)}
      options={options}
      onChange={(value) => onFloor(Number(value))}
      ariaLabel={t('dungeon.preview.floor')}
      roving
    />
  );
}
