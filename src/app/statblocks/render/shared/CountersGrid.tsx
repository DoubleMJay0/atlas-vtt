import React from 'react';
import { Hourglass, Minus, Moon, Plus } from 'lucide-react';
import { t, type MessageKey } from '../../../i18n';
import { LabelTooltip } from '../../../packages/components/primitives/tooltip';
import type { CounterRest, CounterRow } from '../../values/counterValues';

/** Above this many uses a cell shows its count with − and + instead of a pip per use. */
export const MAX_COUNTER_PIPS = 6;

/** A drawn row and its place in the stored list, which a change names. */
export interface ShownCounter {
  row: CounterRow;
  index: number;
}

export interface CounterControls {
  /** Sets the row at `index` of the stored list to `used` uses. Unset: the controls are drawn inert (the template editor). */
  use?: ((index: number, used: number) => void) | undefined;
  /** Gives back what `rest` refills. */
  rest?: ((rest: CounterRest) => void) | undefined;
}

interface CountersGridProps {
  counters: readonly ShownCounter[];
  rests: readonly CounterRest[];
  /** Unset: the counts are only shown, without buttons. */
  controls?: CounterControls | undefined;
}

const REST_LABELS: Readonly<Record<CounterRest, MessageKey>> = {
  'short-rest': 'statblock.shortRest',
  'long-rest': 'statblock.longRest',
};

/** What a press on the pip at `position` (left ones first) leaves: down to it where it is still left, else up to it. */
function usedAfterPip(row: CounterRow, position: number): number {
  const left = row.max - row.used;
  return row.max - (position < left ? position : position + 1);
}

function buttonProps(action: (() => void) | undefined): Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled' | 'tabIndex' | 'onClick'> {
  return { type: 'button', disabled: !action, tabIndex: action ? undefined : -1, onClick: action };
}

function Pips({ row, index, controls }: ShownCounter & { controls: CounterControls | undefined }): React.JSX.Element {
  const left = row.max - row.used;
  const look = (position: number): string => `atlas-sb-counter__pip${position < left ? ' is-left' : ''}`;
  if (!controls) {
    return (
      <span className="atlas-sb-counter__pips" role="img" aria-label={t('statblock.counterLeft', { name: row.name, n: left, max: row.max })}>
        {Array.from({ length: row.max }, (_, position) => <span key={position} className={look(position)} />)}
      </span>
    );
  }
  const { use } = controls;
  return (
    <span className="atlas-sb-counter__pips" role="group" aria-label={row.name}>
      {Array.from({ length: row.max }, (_, position) => (
        <button key={position} className="atlas-sb-counter__pip-button" aria-pressed={position < left}
          aria-label={t('statblock.pip', { label: row.name, n: position + 1, max: row.max })}
          {...buttonProps(use && (() => use(index, usedAfterPip(row, position))))}>
          <span className={look(position)} />
        </button>
      ))}
    </span>
  );
}

function Count({ row, index, controls }: ShownCounter & { controls: CounterControls | undefined }): React.JSX.Element {
  const left = row.max - row.used;
  const text = <span className="atlas-sb-counter__count">{left} / {row.max}</span>;
  if (!controls) return text;
  const { use } = controls;
  return (
    <span className="atlas-sb-counter__stepper">
      <LabelTooltip label={t('statblock.decrease', { label: row.name })}>
        <button className="atlas-sb-counter__step" {...buttonProps(use && left > 0 ? () => use(index, row.used + 1) : undefined)}>
          <Minus aria-hidden="true" />
        </button>
      </LabelTooltip>
      {text}
      <LabelTooltip label={t('statblock.increase', { label: row.name })}>
        <button className="atlas-sb-counter__step" {...buttonProps(use && row.used > 0 ? () => use(index, row.used - 1) : undefined)}>
          <Plus aria-hidden="true" />
        </button>
      </LabelTooltip>
    </span>
  );
}

/**
 * A Counters block's rows: a small cell each, its name over its pips (◆ left,
 * ◇ used), or over its count with − and + where it has more uses than pips fit;
 * with controls, the rest buttons under them. A read-only card draws the
 * counts alone.
 */
export function CountersGrid({ counters, rests, controls }: CountersGridProps): React.JSX.Element {
  return (
    <span className="atlas-sb-counters__body">
      <span className="atlas-sb-counters__cells">
        {counters.map((shown) => (
          <span key={shown.index} className="atlas-sb-counter">
            <span className="atlas-sb-counter__name">{shown.row.name}</span>
            {shown.row.max > MAX_COUNTER_PIPS ? <Count {...shown} controls={controls} /> : <Pips {...shown} controls={controls} />}
          </span>
        ))}
      </span>
      {controls && rests.length > 0 && (
        <span className="atlas-sb-counters__rests">
          {rests.map((rest) => {
            const Icon = rest === 'short-rest' ? Hourglass : Moon;
            const { rest: refill } = controls;
            return (
              <button key={rest} className="atlas-sb-counters__rest" {...buttonProps(refill && (() => refill(rest)))}>
                <Icon aria-hidden="true" />
                {t(REST_LABELS[rest])}
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}
