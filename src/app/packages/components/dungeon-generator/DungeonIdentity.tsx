import React, { useEffect, useId, useState } from 'react';
import { Dices } from 'lucide-react';
import { Button } from '../primitives/button';
import { LabelTooltip } from '../primitives/tooltip';
import { MAX_SEED } from '../../../dungeons/rng';
import { t } from '../../../i18n';

interface DungeonIdentityProps {
  name: string;
  /** The title the generator gave the dungeon, shown while no name is typed. */
  generatedTitle: string | null;
  seed: number;
  onName: (name: string) => void;
  onSeed: (seed: number) => void;
  onNew: () => void;
}

/** A typed seed as the generator takes it: a whole number from 1 to `MAX_SEED`, or null. */
export function readSeed(text: string): number | null {
  const value = Number(text.trim());
  if (!Number.isInteger(value)) return null;
  return Math.min(MAX_SEED, Math.max(1, value));
}

/** Name and seed: what makes this dungeon this one. Both are taken when the field is left or Enter is pressed. */
export function DungeonIdentity({ name, generatedTitle, seed, onName, onSeed, onNew }: DungeonIdentityProps): React.JSX.Element {
  const nameId = useId();
  const seedId = useId();
  const [nameText, setNameText] = useState(name);
  const [seedText, setSeedText] = useState(String(seed));
  useEffect(() => setNameText(name), [name]);
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
          value={nameText}
          placeholder={generatedTitle ?? t('dungeon.namePlaceholder')}
          onChange={(event) => setNameText(event.target.value)}
          onBlur={() => onName(nameText)}
          onKeyDown={onEnter(() => onName(nameText))}
        />
      </div>
      <div className="atlas-dungeon-field atlas-dungeon-field--stacked">
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
    </div>
  );
}
