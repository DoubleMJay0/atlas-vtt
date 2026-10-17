import React, { useId } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { t } from '../../../../i18n';
import { Select } from '../../../../packages/components/primitives/Select';
import { ToolButton } from '../../../../packages/components/primitives/ToolButton';
import type { CounterPreset, CounterReset } from '../../../model/templateTypes';
import { useGestureText } from '../inspector/useGestureText';
import type { EditorSession } from '../sessionTypes';

/** The rest a row's Select offers; `none` stands for a row no rest refills, stored as no `reset`. */
type ResetChoice = CounterReset | 'none';

function resetChoices(): Array<{ value: ResetChoice; label: string }> {
  return [
    { value: 'none', label: t('statblock.counterNoRest') },
    { value: 'short-rest', label: t('statblock.shortRest') },
    { value: 'long-rest', label: t('statblock.longRest') },
  ];
}

/** The row refilled by `reset`, or by no rest. */
function withReset(row: CounterPreset, reset: ResetChoice): CounterPreset {
  const { reset: _reset, ...rest } = row;
  return reset === 'none' ? rest : { ...rest, reset };
}

/** Typed uses as a whole number of 0 or more, or null for anything else (kept as typed until the field is left). */
function usesOf(text: string): number | null {
  return /^\s*\d+\s*$/.test(text) ? Number.parseInt(text, 10) : null;
}

export interface CounterRowSettingProps {
  row: CounterPreset;
  index: number;
  count: number;
  session: EditorSession;
  disabled: boolean;
  /** Changes the row as the template holds it now, one undo step. */
  onEdit: (change: (row: CounterPreset) => CounterPreset) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

/** One row a Counters field starts with: its name and uses, the rest that refills it, and Move and Remove. */
export function CounterRowSetting({ row, index, count, session, disabled, onEdit, onMove, onRemove }: CounterRowSettingProps): React.JSX.Element {
  const nameId = useId();
  const usesId = useId();
  const resetId = useId();
  const name = useGestureText({ value: row.name, session, onText: (text) => { if (text.trim()) onEdit((current) => ({ ...current, name: text })); } });
  const uses = useGestureText({
    value: String(row.max),
    session,
    onText: (text) => {
      const max = usesOf(text);
      if (max !== null) onEdit((current) => ({ ...current, max }));
    },
  });
  const named = row.name.trim() || t('statblock.counterRow', { n: index + 1 });
  return (
    <div className="atlas-te-counter-row">
      <span id={nameId} hidden>{t('statblock.counterRow', { n: index + 1 })}</span>
      <span id={usesId} hidden>{t('statblock.counterUses', { name: named })}</span>
      <span id={resetId} hidden>{t('statblock.counterRefills', { name: named })}</span>
      <div className="atlas-te-setting__inline">
        <input {...name} type="text" className="atlas-te-input" aria-labelledby={nameId} disabled={disabled} spellCheck={false} />
        <input {...uses} type="text" inputMode="numeric" className="atlas-te-input atlas-te-input--count" aria-labelledby={usesId} disabled={disabled} />
        <ToolButton icon={X} label={t('statblock.counterRemove', { name: named })} isActive={false} disabled={disabled} onClick={onRemove} />
      </div>
      <div className="atlas-te-setting__inline">
        <Select<ResetChoice> value={row.reset ?? 'none'} options={resetChoices()} labelledBy={resetId} disabled={disabled}
          onChange={(reset) => onEdit((current) => withReset(current, reset))} />
        <ToolButton icon={ArrowUp} label={t('statblock.counterMoveUp', { name: named })} isActive={false} disabled={disabled || index === 0} onClick={() => onMove(index - 1)} />
        <ToolButton icon={ArrowDown} label={t('statblock.counterMoveDown', { name: named })} isActive={false} disabled={disabled || index === count - 1} onClick={() => onMove(index + 1)} />
      </div>
    </div>
  );
}
