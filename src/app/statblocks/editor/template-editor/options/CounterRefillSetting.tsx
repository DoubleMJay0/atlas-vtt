import React, { useId } from 'react';
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react';
import { t } from '../../../../i18n';
import { ToolButton } from '../../../../packages/components/primitives/ToolButton';
import type { CounterRefillDefinition } from '../../../model/templateTypes';
import { useGestureText } from '../inspector/useGestureText';
import type { EditorSession } from '../sessionTypes';

export interface CounterRefillSettingProps {
  refill: CounterRefillDefinition;
  index: number;
  /** The names of the field's refills, in template order. */
  names: readonly string[];
  session: EditorSession;
  disabled: boolean;
  /** Names the refill `name`, one undo step; refused where the name is empty or another refill's. */
  onRename: (name: string) => void;
  /** Brings `other` along with the refill, or no longer. */
  onInclude: (other: string, included: boolean) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

/** One refill of a Counters field: its name, the other refills it brings along as checks, and Move and Remove. */
export function CounterRefillSetting({ refill, index, names, session, disabled, onRename, onInclude, onMove, onRemove }: CounterRefillSettingProps): React.JSX.Element {
  const nameId = useId();
  const includesId = useId();
  // Typed in full and put in once: a rename carries the rows it refills along.
  const name = useGestureText({ value: refill.name, session, mode: 'commit', onText: (text) => onRename(text) });
  const others = names.filter((other) => other !== refill.name);
  const includes = new Set(refill.includes ?? []);
  return (
    <div className="atlas-te-counter-row">
      <span id={nameId} hidden>{t('statblock.counterRefill', { n: index + 1 })}</span>
      <div className="atlas-te-setting__inline">
        <input {...name} type="text" className="atlas-te-input" aria-labelledby={nameId} disabled={disabled} spellCheck={false} />
        <ToolButton icon={ArrowUp} label={t('statblock.counterMoveUp', { name: refill.name })} isActive={false} disabled={disabled || index === 0} onClick={() => onMove(index - 1)} />
        <ToolButton icon={ArrowDown} label={t('statblock.counterMoveDown', { name: refill.name })} isActive={false} disabled={disabled || index === names.length - 1} onClick={() => onMove(index + 1)} />
        <ToolButton icon={X} label={t('statblock.counterRemove', { name: refill.name })} isActive={false} disabled={disabled} onClick={onRemove} />
      </div>
      {others.length > 0 && (
        <div className="atlas-te-setting__suggestions" role="group" aria-labelledby={includesId}>
          <span id={includesId} className="atlas-te-counter-row__note">{t('statblock.counterRefillIncludes')}</span>
          {others.map((other) => {
            const on = includes.has(other);
            return (
              <button key={other} type="button" className="atlas-te-suggestion" aria-pressed={on} disabled={disabled} onClick={() => onInclude(other, !on)}>
                {on && <Check aria-hidden="true" />}
                {other}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
