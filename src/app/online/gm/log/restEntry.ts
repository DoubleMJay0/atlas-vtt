import { MAX_REST_CHANGES, MAX_REST_ROLL, MAX_REST_TEXT, MAX_TOKEN_VALUE, type RestChange, type RestEntry } from '../../protocol/index.ts';
import { readableFormula } from '../../../recovery/recoveryFormula';
import type { RestSummary } from '../../../recovery/restEvents';
import type { RestChange as TakenChange } from '../../../recovery/restTypes';
import { cutLine } from '../shownText.ts';

/** What a rest's log entry holds beyond its stamp. */
export type RestRecord = Pick<RestEntry, 'character' | 'button' | 'changes' | 'skipped'>;

/** What a character or button without a name is called in the log. */
const UNNAMED = 'Unnamed';

/** A number of a change as the log carries it: a whole number within what the protocol takes. */
const bounded = (value: number): number => (Number.isFinite(value) ? Math.max(-MAX_TOKEN_VALUE, Math.min(MAX_TOKEN_VALUE, value)) : 0);

/** One change as the log names it, its rolls written "2d8+2 = 9"; null for one whose label shows nothing. */
function changeOf(change: TakenChange): RestChange | null {
  const label = cutLine(change.label, MAX_REST_TEXT);
  const rolls = change.rolls.map((roll) => `${readableFormula(roll.formula)} = ${roll.total}`).join(', ');
  const roll = rolls === '' ? null : cutLine(rolls, MAX_REST_ROLL);
  return label === null ? null : { label, from: bounded(change.from), to: bounded(change.to), ...(roll !== null && { roll }) };
}

/**
 * A rest the GM's Atlas took, as the table's log keeps it: the character and the button by name,
 * what it changed with the rolls that decided it, and the names of what it could not change, each
 * text cut to what the protocol carries in the form players are shown it, so the entry reads back
 * exactly as it was sent.
 */
export function restRecordOf(rest: RestSummary): RestRecord {
  const changes = rest.changes.flatMap((change) => changeOf(change) ?? []).slice(0, MAX_REST_CHANGES);
  const skipped = [...new Set(rest.skipped.flatMap((rule) => cutLine(rule.label, MAX_REST_TEXT) ?? []))].slice(0, MAX_REST_CHANGES);
  return {
    character: cutLine(rest.characterName, MAX_REST_TEXT) ?? UNNAMED,
    button: cutLine(rest.button.name, MAX_REST_TEXT) ?? UNNAMED,
    changes,
    ...(skipped.length > 0 && { skipped }),
  };
}
