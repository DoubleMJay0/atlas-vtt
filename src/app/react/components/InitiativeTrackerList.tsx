import React, { useId } from 'react';
import { SIDE_LABELS, sideOf, sidesInOrder } from '../../initiative/sides';
import type { TokenEntity } from '../../types';
import type { InitiativeEntry } from '../../types/initiativeTypes';
import type { InitiativeSide } from '../../types/initiativeRulesTypes';
import { t } from '../../i18n';

interface InitiativeTrackerListProps {
  /** Every combatant in turn order. */
  entries: readonly InitiativeEntry[];
  tokens: Readonly<Record<string, TokenEntity>>;
  bySides: boolean;
  firstSide: InitiativeSide;
  /** The side whose turn it is in a fight by sides. */
  activeSide: InitiativeSide | undefined;
  /** Draws a card; `index` is its place among all combatants, which is what a drag reorders. */
  card: (entry: InitiativeEntry, index: number) => React.ReactElement;
}

/**
 * The tracker's combatants: under their side in a fight by sides, else in turn order, with
 * those that delayed their turn waiting below the order until they act.
 */
export const InitiativeTrackerList: React.FC<InitiativeTrackerListProps> = ({ entries, tokens, bySides, firstSide, activeSide, card }) => {
  const labelId = useId();
  const placed = entries.map((entry, index) => ({ entry, index }));

  if (bySides) {
    return (
      <>
        {sidesInOrder(firstSide).map((side) => (
          <section
            key={side}
            className={`atlas-initiative-side ${activeSide === side ? 'atlas-initiative-side--active' : ''}`}
            aria-labelledby={`${labelId}-${side}`}
            aria-current={activeSide === side || undefined}
          >
            <h4 id={`${labelId}-${side}`} className="atlas-initiative-side__label">{SIDE_LABELS[side]}</h4>
            {placed.map(({ entry, index }) => sideOf(tokens[entry.tokenId]) === side && card(entry, index))}
          </section>
        ))}
      </>
    );
  }

  const delayed = placed.filter(({ entry }) => entry.delayed);
  return (
    <>
      {placed.map(({ entry, index }) => !entry.delayed && card(entry, index))}
      {delayed.length > 0 && (
        <section className="atlas-initiative-side atlas-initiative-side--delayed" aria-labelledby={`${labelId}-delayed`}>
          <h4 id={`${labelId}-delayed`} className="atlas-initiative-side__label">{t('initiative.delayed')}</h4>
          {delayed.map(({ entry, index }) => card(entry, index))}
        </section>
      )}
    </>
  );
};
