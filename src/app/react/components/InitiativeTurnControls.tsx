import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { t } from '../../i18n';

interface InitiativeTurnControlsProps {
  fightRuns: boolean;
  round: number;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * The tracker's foot: the turn before, the round and the next turn. Always shown, disabled while no
 * fight runs; a turn hotkey (`atlas-initiative-hotkey`) presses its button for a moment.
 */
export function InitiativeTurnControls({ fightRuns, round, onPrevious, onNext }: InitiativeTurnControlsProps): React.ReactElement {
  const [pressed, setPressed] = useState<'prev' | 'next' | null>(null);

  useEffect(() => {
    const handleHotkey = (e: CustomEvent<'prev' | 'next'>): void => {
      setPressed(e.detail);
      window.setTimeout(() => setPressed(null), 150);
    };
    window.addEventListener('atlas-initiative-hotkey', handleHotkey as EventListener);
    return () => window.removeEventListener('atlas-initiative-hotkey', handleHotkey as EventListener);
  }, []);

  const buttonClass = (which: 'prev' | 'next'): string =>
    `clickable-icon atlas-initiative-tracker__btn ${pressed === which ? 'atlas-initiative-tracker__btn--pressed' : ''}`;

  return (
    <div className="atlas-initiative-tracker__turn-controls">
      <button className={buttonClass('prev')} onClick={onPrevious} disabled={!fightRuns}>
        <ChevronUp />
      </button>
      <span className="atlas-initiative-tracker__round">{fightRuns ? t('initiative.roundShort', { round }) : '—'}</span>
      <button className={buttonClass('next')} onClick={onNext} disabled={!fightRuns}>
        <ChevronDown />
      </button>
    </div>
  );
}
