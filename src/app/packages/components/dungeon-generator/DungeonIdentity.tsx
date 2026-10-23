import React, { useEffect, useId, useState } from 'react';
import { Dices } from 'lucide-react';
import { Button } from '../primitives/button';
import { LabelTooltip } from '../primitives/tooltip';
import { MAX_FLOORS } from '../../../dungeons/model';
import { MAX_SEED } from '../../../dungeons/rng';
import { t } from '../../../i18n';
import { Stepper } from './fields';

interface DungeonIdentityProps {
  /** What the scene is called; the dungeon does not change with it. */
  name: string;
  seed: number;
  onName: (name: string) => void;
  onSeed: (seed: number) => void;
  onNew: () => void;
  /** How many floors the dungeon has (one while `floorsFixed`). */
  floors: number;
  onFloors: (floors: number) => void;
  /** The count is fixed (a five-room dungeon has one floor). */
  floorsFixed: boolean;
}

/** A typed seed as the generator takes it: a whole number from 1 to `MAX_SEED`, or null. */
function readSeed(text: string): number | null {
  const value = Number(text.trim());
  if (!Number.isInteger(value)) return null;
  return Math.min(MAX_SEED, Math.max(1, value));
}

/**
 * Name, seed and floors. The seed makes this dungeon this one; the name only names its scene and
 * is taken as it is typed, the seed when the field is left or Enter is pressed.
 */
export function DungeonIdentity({ name, seed, onName, onSeed, onNew, floors, onFloors, floorsFixed }: DungeonIdentityProps): React.JSX.Element {
  const nameId = useId();
  const seedId = useId();
  const floorsId = useId();
  const [seedText, setSeedText] = useState(String(seed));
  useEffect(() => setSeedText(String(seed)), [seed]);

  const takeSeed = (): void => {
    const next = readSeed(seedText);
    if (next === null) setSeedText(String(seed));
    else {
      setSeedText(String(next));
      onSeed(next);
    }
  };
  const onEnter = (take: () => void) => (event: React.KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    take();
  };

  return (
    <div className="atlas-dungeon-identity">
      <div className="atlas-dungeon-field atlas-dungeon-field--stacked">
        <span id={nameId} className="atlas-dungeon-field__label">{t('dungeon.name')}</span>
        <input
          type="text"
          className="atlas-dungeon-field__text"
          aria-labelledby={nameId}
          value={name}
          placeholder={t('dungeon.namePlaceholder')}
          onChange={(event) => onName(event.target.value)}
        />
      </div>
      <div className="atlas-dungeon-identity__row">
        <div className="atlas-dungeon-field atlas-dungeon-field--stacked atlas-dungeon-identity__seed-field">
          <span id={seedId} className="atlas-dungeon-field__label">{t('dungeon.seed')}</span>
          <div className="atlas-dungeon-identity__seed">
            <input
              type="text"
              inputMode="numeric"
              className="atlas-dungeon-field__text atlas-dungeon-field__seed"
              aria-labelledby={seedId}
              value={seedText}
              onChange={(event) => setSeedText(event.target.value.replace(/[^\d]/g, ''))}
              onBlur={takeSeed}
              onKeyDown={onEnter(takeSeed)}
            />
            <LabelTooltip label={t('dungeon.new')}>
              <Button variant="outline" size="icon" className="atlas-dungeon-identity__reroll" onClick={onNew}>
                <Dices />
              </Button>
            </LabelTooltip>
          </div>
        </div>
        <div className="atlas-dungeon-field atlas-dungeon-field--stacked">
          <span id={floorsId} className="atlas-dungeon-field__label">{t('dungeon.floors')}</span>
          <Stepper
            labelledBy={floorsId}
            value={floors}
            min={1}
            max={MAX_FLOORS}
            onChange={onFloors}
            fewer={t('dungeon.floors.fewer')}
            more={t('dungeon.floors.more')}
            disabled={floorsFixed}
          />
        </div>
      </div>
    </div>
  );
}
