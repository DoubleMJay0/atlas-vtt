import React from 'react';
import { SegmentedControl } from '../../../../packages/components/primitives/SegmentedControl';
import { t } from '../../../../i18n';
import { withRows } from '../../../../recovery/editor/recoveryEdits';
import type { RecoveryButton, RecoveryRule, ResourceOrCounters } from '../../../../recovery/recoveryTypes';
import { FormulaInput, RowsChips, WholeInput, type FieldChoice } from './RuleInputs';
import { SetToInput } from './SetToInput';

export interface RuleCardProps {
  rule: RecoveryRule | undefined;
  /** The metric's name and colour, and the button the rule belongs to. */
  metric: string;
  color: string | undefined;
  button: RecoveryButton;
  /** The template's buttons, which a counters rule picks rows by. */
  buttons: readonly RecoveryButton[];
  fields: readonly FieldChoice[];
  nameOf: (target: ResourceOrCounters) => string;
  /** Its first field takes focus: opened from the keyboard. */
  focusFirst: boolean;
  onChange: (rule: RecoveryRule) => void;
  onPickSource: () => void;
}

/** What a rule asks for beyond its kind: formulas and numbers, a share, what it spends. */
function RuleFields({ rule, fields, nameOf, focusFirst, onChange, onPickSource }: Omit<RuleCardProps, 'metric' | 'color' | 'button' | 'buttons'> & { rule: RecoveryRule }): React.ReactElement | null {
  switch (rule.does) {
    case 'amount':
      return (
        <>
          <FormulaInput label={t('recoveryEditor.card.formula')} value={rule.formula} fields={fields} autoFocus={focusFirst}
            onChange={(formula) => onChange({ ...rule, formula })} />
          <WholeInput label={t('recoveryEditor.card.atLeast')} value={rule.min} least={0} optional inline
            onChange={(min) => onChange(min === undefined ? { target: rule.target, does: 'amount', formula: rule.formula } : { ...rule, min })} />
        </>
      );
    case 'share':
      return (
        <>
          <div className="atlas-rc-card__field atlas-rc-card__field--wide">
            <span className="atlas-rc-card__label">{t('recoveryEditor.card.share')}</span>
            <SegmentedControl ariaLabel={t('recoveryEditor.card.share')} value={rule.share === 0.5 ? 'half' : 'quarter'}
              options={[{ value: 'half', label: `½ ${t('recoveryEditor.card.half')}` }, { value: 'quarter', label: `¼ ${t('recoveryEditor.card.quarter')}` }]}
              onChange={(share) => onChange({ ...rule, share: share === 'half' ? 0.5 : 0.25 })} />
          </div>
          <div className="atlas-rc-card__field">
            <span className="atlas-rc-card__label">{t('recoveryEditor.card.round')}</span>
            <SegmentedControl ariaLabel={t('recoveryEditor.card.round')} value={rule.round}
              options={[{ value: 'down', label: t('recoveryEditor.card.down') }, { value: 'up', label: t('recoveryEditor.card.up') }]}
              onChange={(round) => onChange({ ...rule, round })} />
          </div>
          <WholeInput label={t('recoveryEditor.card.atLeast')} value={rule.min} least={0} optional
            onChange={(min) => onChange(min === undefined ? { target: rule.target, does: 'share', share: rule.share, round: rule.round } : { ...rule, min })} />
        </>
      );
    case 'set':
      return <SetToInput value={rule.to} fields={fields} autoFocus={focusFirst} onChange={(to) => onChange({ ...rule, to })} />;
    case 'spend':
      return (
        <>
          <div className="atlas-rc-card__field atlas-rc-card__field--wide">
            <span className="atlas-rc-card__label">{t('recoveryEditor.card.spends')}</span>
            <div className="atlas-rc-card__source">
              <span className="atlas-rc-card__source-name">{nameOf(rule.from)}</span>
              <button type="button" className="atlas-rc-card__change" onClick={onPickSource}>{t('recoveryEditor.card.changeSource')}</button>
            </div>
          </div>
          <FormulaInput label={t('recoveryEditor.card.each')} value={rule.each} fields={fields} autoFocus={focusFirst}
            onChange={(each) => onChange({ ...rule, each })} />
          <WholeInput label={t('recoveryEditor.card.most')} value={rule.most} least={1} optional inline
            onChange={(most) => onChange(most === undefined ? { target: rule.target, does: 'spend', from: rule.from, each: rule.each } : { ...rule, most })} />
        </>
      );
    case 'step':
      return <WholeInput label={t('recoveryEditor.card.lowerBy')} value={Math.abs(rule.by)} least={1} autoFocus={focusFirst} inline
        onChange={(by) => { if (by !== undefined) onChange({ ...rule, by: -by }); }} />;
    default:
      return null;
  }
}

/**
 * The card under a picked metric, for a rule that asks for more than its kind (the ResourceCard's
 * idiom): its numbers or formula, a counters rule's rows, and for Spend what it spends.
 */
export function RuleCard(props: RuleCardProps): React.ReactElement | null {
  const { rule, metric, color, button, buttons, onChange } = props;
  if (!rule) return null;

  return (
    <div className="atlas-rc-card" role="group" aria-label={t('recoveryEditor.metricRule', { metric, rule: button.name })}>
      <div className="atlas-rc-card__head">
        <span className="atlas-rc-card__dot" style={color ? { backgroundColor: color } : undefined} aria-hidden="true" />
        <span className="atlas-rc-card__metric">{metric}</span>
        <span className="atlas-rc-card__button">{button.name}</span>
      </div>
      <div className="atlas-rc-card__fields">
        <RuleFields {...props} rule={rule} />
        {rule.target.kind === 'counters' && (
          <RowsChips rows={rule.target.rows} buttons={buttons} onChange={(rows) => onChange(withRows(rule, rows))} />
        )}
      </div>
    </div>
  );
}
