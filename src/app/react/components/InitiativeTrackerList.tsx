import React, { useId } from 'react';
import { sideOf, type ListedSide } from '../../initiative/sides';
import type { TokenEntity } from '../../types';
import type { InitiativeEntry } from '../../types/initiativeTypes';
import { t } from '../../i18n';

interface InitiativeTrackerListProps {
  /** Every combatant in turn order. */
  entries: readonly InitiativeEntry[];
  tokens: Readonly<Record<string, TokenEntity>>;
  bySides: boolean;
  /** The sides in the order they act this round, the side or sides with the turn marked (`listedSides`). */
  sides: readonly ListedSide[];
  /** Draws a card; `index` is its place among all combatants, which is what a drag reorders. */
  card: (entry: InitiativeEntry, index: number) => React.ReactElement;
}

/**
 * The tracker's combatants: under their side in a fight by sides, else in turn order, with
 * those that delayed their turn waiting below the order until they act.
 */
export const InitiativeTrackerList: React.FC<InitiativeTrackerListProps> = ({ entries, tokens, bySides, sides, card }) => {
  const labelId = useId();
  const placed = entries.map((entry, index) => ({ entry, index }));

  if (bySides) {
    const known = sides.map((side) => side.id);
    return (
      <>
        {sides.map((side, at) => (
          <section
            key={side.id}
            className={`atlas-initiative-side ${side.active ? 'atlas-initiative-side--active' : ''}`}
            aria-labelledby={`${labelId}-${at}`}
            aria-current={side.active || undefined}
          >
            <h4 id={`${labelId}-${at}`} className="atlas-initiative-side__label">
              {side.roll === null ? side.name : (
                <>
                  <span className="atlas-initiative-side__name">{side.name}</span>
                  <span className="atlas-initiative-side__roll">{side.roll}</span>
                </>
              )}
            </h4>
            {placed.map(({ entry, index }) => sideOf(tokens[entry.tokenId], known) === side.id && card(entry, index))}
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
