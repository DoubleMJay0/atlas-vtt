import type { BookRefillMessage } from '../../protocol/index.ts';
import { fieldPatches } from '../../../statblocks/editor/statblock-pane/valuePatches';
import { withHeaderFields } from '../../../statblocks/model/templateHeader';
import { refillSheet, type RefillTarget, type RegainRoll } from '../../../statblocks/values/counterRefill';
import { templateRefills } from '../../../statblocks/values/counterValues';
import type { FieldRead } from '../../../statblocks/values/fieldValues';
import { playerAccess } from './playerAccess.ts';
import { editableTemplate, sentFields, writtenValue, type CheckedEdit, type EditInputs } from './statblockChecks.ts';

/**
 * A player's refill of their own character's sheet ("Long rest"), checked and worked out as the note
 * panel's button works it out (`refillSheet`): the statblock is a native one whose template reads as
 * it was written, the template defines the refill and the sheet last sent to them offered it, and only
 * the Counters values that sheet offered them and the template still lets players change get their
 * uses back. A regained formula is rolled by `roll`, the GM's Atlas. Null where anything of it is
 * refused, a value was not read yet or a roll was not made; no patches where nothing comes back.
 */
export function checkRefill(inputs: EditInputs, message: BookRefillMessage, roll: RegainRoll): CheckedEdit | null {
  const template = editableTemplate(inputs);
  const sent = inputs.sent;
  if (template === null || sent === null || sent === undefined) return null;
  const refills = templateRefills(template);
  if (!refills.some((refill) => refill.name === message.refill) || !sent.refills.some((refill) => refill.name === message.refill)) return null;
  const offered = new Set(sentFields(sent).filter((field) => field.type === 'counters').map((field) => field.key));
  const fields = withHeaderFields(template).fields.filter((field) => field.type === 'counters' && offered.has(field.key) && playerAccess(template, field.key) === 'edit');
  const reads = new Map<string, FieldRead>();
  const targets: RefillTarget[] = [];
  for (const field of fields) {
    const read = inputs.read(field);
    if (read === undefined) return null;
    reads.set(field.key, read);
    targets.push({ field, value: read.value });
  }
  const refilled = refillSheet(targets, refills, new Set(refills.map((refill) => refill.name)), message.refill, roll);
  if (refilled === null) return null;
  return {
    patches: refilled.flatMap(({ field, next }) => fieldPatches(field.key, reads.get(field.key)!, next)),
    written: refilled.map(({ field, next }) => writtenValue(field.key, reads.get(field.key)!, next)),
  };
}
