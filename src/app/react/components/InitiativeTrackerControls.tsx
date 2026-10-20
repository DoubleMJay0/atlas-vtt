import React from 'react';
import { Dices, Ellipsis, Swords } from 'lucide-react';
import { LabelTooltip } from '../../packages/components/primitives/tooltip';
import { EndCombatIcon } from './EndCombatIcon';
import { t } from '../../i18n';

interface InitiativeTrackerControlsProps {
  /** The combatants roll for their numbers (turn order); by sides or by cards nothing is rolled. */
  rolls: boolean;
  /** The tracker holds no combatant. */
  empty: boolean;
  rolling: boolean;
  fightRuns: boolean;
  onRoll: () => void;
  onStart: () => void;
  onEnd: () => void;
  onOptions: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/** The tracker's header: roll, start or end the fight, and the ⋯ options. */
export function InitiativeTrackerControls({ rolls, empty, rolling, fightRuns, onRoll, onStart, onEnd, onOptions }: InitiativeTrackerControlsProps): React.ReactElement {
  return (
    <div className="atlas-initiative-tracker__controls">
      {rolls && (
        <LabelTooltip label="Roll initiative">
          <button className="clickable-icon atlas-initiative-tracker__btn" onClick={onRoll} disabled={empty || rolling}>
            <Dices />
          </button>
        </LabelTooltip>
      )}

      {!fightRuns ? (
        <LabelTooltip label="Start combat">
          <button className="clickable-icon atlas-initiative-tracker__btn" onClick={onStart} disabled={empty}>
            <Swords />
          </button>
        </LabelTooltip>
      ) : (
        <LabelTooltip label="End combat">
          <button className="clickable-icon atlas-initiative-tracker__btn atlas-initiative-tracker__btn--end" onClick={onEnd}>
            <EndCombatIcon />
          </button>
        </LabelTooltip>
      )}

      <LabelTooltip label={t('initiative.options')}>
        <button className="clickable-icon atlas-initiative-tracker__btn" onClick={onOptions} aria-haspopup="menu">
          <Ellipsis />
        </button>
      </LabelTooltip>
    </div>
  );
}
