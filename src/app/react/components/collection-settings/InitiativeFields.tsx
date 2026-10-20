/**
 * InitiativeFields — How the collection's initiative tracker runs a fight.
 */

import React from 'react';
import { ObsidianMenuDropdown } from '../ObsidianMenuDropdown';
import { isValidDefaultRoll } from '../../../gameSystems/diceRules';
import type { FieldSuggestion } from '../../../resources/resourceFieldSuggestions';
import type { InitiativeMode, InitiativeRules } from '../../../types/initiativeRulesTypes';
import { t } from '../../../i18n';
import { InitiativeModifierFields } from './InitiativeModifierFields';
import { InitiativeSideFields } from './InitiativeSideFields';
import { InitiativeCardFields } from './InitiativeCardFields';

interface InitiativeFieldsProps {
  initiative: InitiativeRules;
  onChange: (initiative: InitiativeRules) => void;
  /** The statblock fields offered for the modifier (`initiativeFieldSuggestions`). */
  fieldSuggestions: readonly FieldSuggestion[];
}

const MODE_OPTIONS: Record<InitiativeMode, string> = {
  'turn-order': t('initRules.mode.turnOrder'),
  sides: t('initRules.mode.sides'),
  cards: t('initRules.mode.cards'),
};

const MODE_DESCRIPTIONS: Record<InitiativeMode, string> = {
  'turn-order': t('initRules.mode.turnOrderHint'),
  sides: t('initRules.mode.sidesHint'),
  cards: t('initRules.mode.cardsHint'),
};

export function InitiativeFields({ initiative, onChange, fieldSuggestions }: InitiativeFieldsProps): React.ReactElement {
  const rollValid = isValidDefaultRoll(initiative.roll);

  return (
    <>
      <div className="atlas-csm-field">
        <label className="atlas-csm-label">{t('initRules.label')}</label>
        <ObsidianMenuDropdown
          className="atlas-setting-dropdown atlas-csm-dropdown"
          value={initiative.mode}
          options={MODE_OPTIONS}
          onChange={(value) => onChange({ ...initiative, mode: value as InitiativeMode })}
        />
        <p className="atlas-csm-hint">
          {MODE_DESCRIPTIONS[initiative.mode]} {t('initRules.applies')}
        </p>
      </div>

      {initiative.mode === 'turn-order' && (
        <>
          <div className="atlas-csm-field">
            <label className="atlas-csm-label" htmlFor="atlas-csm-initiative-roll">{t('initRules.roll')}</label>
            <input
              id="atlas-csm-initiative-roll"
              type="text"
              className="atlas-csm-input"
              placeholder="1d20"
              spellCheck={false}
              aria-invalid={!rollValid || undefined}
              value={initiative.roll}
              onChange={(e) => onChange({ ...initiative, roll: e.target.value })}
            />
            {!rollValid && (
              <p className="atlas-csm-hint atlas-csm-hint--error" role="alert">{t('initRules.rollError')}</p>
            )}
          </div>
          <InitiativeModifierFields initiative={initiative} onChange={onChange} fieldSuggestions={fieldSuggestions} />
        </>
      )}
      {initiative.mode === 'sides' && <InitiativeSideFields initiative={initiative} onChange={onChange} />}
      {initiative.mode === 'cards' && <InitiativeCardFields initiative={initiative} onChange={onChange} />}
    </>
  );
}
