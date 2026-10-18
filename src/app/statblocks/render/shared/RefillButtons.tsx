import React, { useContext } from 'react';
import { RotateCcw } from 'lucide-react';
import type { CounterRefill } from '../../../online/protocol/sheetCounters';
import { offeredRefills, type RefillTarget } from '../../values/counterRefill';
import type { SheetState } from '../sheetState';
import { ValueEditingContext } from '../valueSlot';
import { buttonProps } from './CountersGrid';

/** Every Counters field of the sheet, with the value `read` says it holds. */
export function sheetRefillTargets(state: SheetState, read: (field: RefillTarget['field']) => RefillTarget['value']): RefillTarget[] {
  return [...state.fields.values()].filter((field) => field.type === 'counters').map((field) => ({ field, value: read(field) }));
}

/** The refills the sheet offers now: those that would refill one drawn row of one of its Counters fields. */
export function sheetOfferedRefills(state: SheetState, targets: readonly RefillTarget[]): CounterRefill[] {
  return offeredRefills(state.refills, targets, state.refillNames);
}

interface RefillButtonsProps {
  refills: readonly CounterRefill[];
  /** Takes the refill named `name`. Unset: the buttons are drawn inert (the template editor). */
  onRefill?: ((name: string) => void) | undefined;
}

/** One row of refill buttons for the whole sheet, each named as the template names it; nothing where it offers none. */
export function RefillButtons({ refills, onRefill }: RefillButtonsProps): React.JSX.Element | null {
  if (refills.length === 0) return null;
  return (
    <div className="atlas-sb-refills">
      {refills.map(({ name }) => (
        <button key={name} className="atlas-sb-refill" {...buttonProps(onRefill && (() => onRefill(name)))}>
          <RotateCcw aria-hidden="true" />
          {name}
        </button>
      ))}
    </div>
  );
}

/** What stands under the header where a surface edits the statblock (`ValueEditing.refills`); a card that is only read shows none. */
export function SheetRefillsSlot(): React.ReactNode {
  const editing = useContext(ValueEditingContext);
  return editing?.refills?.() ?? null;
}
