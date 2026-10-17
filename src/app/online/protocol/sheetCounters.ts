import { bookLine, MAX_BOOK_TITLE } from './bookText.ts';
import { isRecord } from './shape.ts';

/** The most rows one Counters block holds, and the largest maximum of a row. */
export const MAX_COUNTERS = 24;
export const MAX_COUNTER = 1000;
/** When a counter's uses come back: on a short or a long rest (a long rest also refills what a short one does). */
export const COUNTER_RESETS = ['short-rest', 'long-rest'] as const;
export type CounterReset = (typeof COUNTER_RESETS)[number];

/**
 * One row of a Counters block: something with limited uses (a level's spell slots, ki, a feature's uses
 * per day). `used` of `max` are spent; `reset` says which rest gives them back. As the note stores it.
 */
export interface SheetCounter {
  readonly name: string;
  readonly max: number;
  readonly used: number;
  readonly reset: CounterReset | null;
}

const isWhole = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

/** A row of a Counters block, or null when it is malformed: a name, a whole maximum, as many used as that at most. */
export function parseCounter(value: unknown): SheetCounter | null {
  if (!isRecord(value) || !isWhole(value.max, MAX_COUNTER) || !isWhole(value.used, value.max)) return null;
  const name = bookLine(value.name, MAX_BOOK_TITLE);
  const reset = value.reset === undefined || value.reset === null ? null : (COUNTER_RESETS as readonly unknown[]).includes(value.reset) ? (value.reset as CounterReset) : undefined;
  return name === null || reset === undefined ? null : { name, max: value.max, used: value.used, reset };
}
