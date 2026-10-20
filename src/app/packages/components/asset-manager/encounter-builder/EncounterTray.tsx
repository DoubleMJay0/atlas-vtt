import React from 'react';
import { Button } from '../../primitives/button';
import { LabelTooltip } from '../../primitives/tooltip';
import { TokenPortrait } from '../../shared/TokenPortrait';
import { formatRange } from '../../../../creatures/creatureValues';
import { t } from '../../../../i18n';
import type { TokenAsset } from '../types';
import { CountStepper } from './CountStepper';
import type { EncounterPick } from './encounterPicks';
import type { EncounterMetrics } from './encounterMetrics';

interface EncounterTrayProps {
  picks: readonly EncounterPick[];
  metrics: EncounterMetrics;
  saving: boolean;
  onCountChange: (token: TokenAsset, count: number) => void;
  onClear: () => void;
  onSave: () => void;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }): React.JSX.Element {
  return (
    <LabelTooltip label={hint} describe>
      <span className="atlas-encounter-tray__metric" tabIndex={0}>
        <span className="atlas-encounter-tray__metric-label">{label}</span>
        <span className="atlas-encounter-tray__metric-value">{value}</span>
      </span>
    </LabelTooltip>
  );
}

/** The encounter being built: its creatures with their counts, what can be said of it in any system, and Save. */
export function EncounterTray({ picks, metrics, saving, onCountChange, onClear, onSave }: EncounterTrayProps): React.JSX.Element {
  const empty = picks.length === 0;
  return (
    <footer className="atlas-encounter-tray" data-empty={empty}>
      {empty ? (
        <p className="atlas-encounter-tray__empty">{t('encounter.builder.empty')}</p>
      ) : (
        <ul className="atlas-encounter-tray__picks">
          {picks.map(({ token, count }) => (
            <li key={token.id} className="atlas-encounter-tray__pick">
              <TokenPortrait src={token.thumbnailUrl ?? token.imageUrl} alt="" showRing={token.showRing} className="atlas-encounter-tray__portrait" />
              <span className="atlas-encounter-tray__name">{token.name}</span>
              <CountStepper name={token.name} count={count} onChange={(next) => onCountChange(token, next)} />
            </li>
          ))}
        </ul>
      )}
      <div className="atlas-encounter-tray__summary">
        <span className="atlas-encounter-tray__count">{t('encounter.builder.count', { count: metrics.count })}</span>
        {metrics.rating && (
          <Metric label={metrics.rating.label} value={formatRange(metrics.rating)} hint={t('encounter.builder.ratingHint')} />
        )}
        {metrics.totals.map((total) => (
          <Metric key={total.key} label={total.name} value={String(total.value)} hint={t('encounter.builder.totalHint', { name: total.name })} />
        ))}
        <div className="atlas-encounter-tray__actions">
          <Button variant="ghost" disabled={empty || saving} onClick={onClear}>{t('encounter.builder.clear')}</Button>
          <Button variant="default" disabled={empty || saving} onClick={onSave}>{t('encounter.builder.save')}</Button>
        </div>
      </div>
    </footer>
  );
}
