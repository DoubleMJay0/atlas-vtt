import { matchingKey } from '../../../resources/resourceFields';
import type { ResourceDefinition, ResourceHolder } from '../../../resources/resourceTypes';
import { statblockResourceValue } from '../../../resources/statblockResourceValues';
import { shownFieldsOf, type ResolvedStatblock } from '../../../statblocks/model/resolvedTypes';
import { fieldByKey } from '../../../statblocks/model/fieldKeys';
import { withHeaderFields } from '../../../statblocks/model/templateHeader';
import type { FieldKey, FieldValue } from '../../../statblocks/model/templateTypes';
import { readField } from '../../../statblocks/values/fieldValues';
import { isWholeNumberText } from '../../../statblocks/values/numberText';
import type { TrackedNumber } from '../../../statblocks/values/trackedNumbers';
import { playerAccess } from './playerAccess.ts';

/**
 * Where the maximum a player sets of their character's resource is written: into a number field of
 * their character's note (`note`), where the maximum follows it, or by hand (`hand`): the token's
 * `overriddenMax`, and the played campaign's `maxByHand` for a character no shown scene holds.
 */
export type MaxRoute = { readonly kind: 'note'; readonly field: FieldKey } | { readonly kind: 'hand' };

const BY_HAND: MaxRoute = { kind: 'hand' };

/** A token as far as its maximums follow its note: linked to it, and not set by hand. */
export type MaxHolder = ResourceHolder & { readonly kind?: string; readonly statblockPath?: string | undefined };

/** A number as the note stores it and a page may write back: a whole number from 0 up, or text that is one and nothing else. Anything worked out (`@level * 2`, `10+2`) is none. */
function isPlainNumber(value: FieldValue | undefined): boolean {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0;
  return typeof value === 'string' && isWholeNumberText(value) && !/^\s*[+-]/.test(value);
}

/**
 * The note field `key` as the place a player writes a maximum: a number field of a native note whose
 * template reads as it was written, which the template lets players change (`playerAccess`), holding
 * a plain number. Null where it is anything else: a hidden or read-only field, a formula, no value.
 */
export function noteMaxRoute(resolved: ResolvedStatblock | null | undefined, key: FieldKey): MaxRoute | null {
  const template = resolved?.source.kind === 'atlas' && resolved.templateStatus === 'ok' ? resolved.template : null;
  if (!resolved || !template || playerAccess(template, key) !== 'edit') return null;
  const field = fieldByKey(withHeaderFields(template).fields, key);
  if (field?.type !== 'number' || !isPlainNumber(readField(resolved.fields, field).value)) return null;
  return { kind: 'note', field: field.key };
}

/** A tracked number's maximum: always its note's (`maxField`), so only where that field takes a player's number. */
export function trackedMaxRoute(resolved: ResolvedStatblock | null | undefined, tracked: Pick<TrackedNumber, 'maxField'>): MaxRoute | null {
  return noteMaxRoute(resolved, tracked.maxField);
}

/**
 * Where the maximum of a collection resource the character's token holds is written. While the token
 * follows its note (linked to `statblockPath`, the maximum not set by hand, the note giving the
 * resource a value) it is the note's field, where a player may write it (else nobody but the GM
 * changes it); otherwise the token's maximum is its own, set by hand. Null while the note is read.
 */
export function heldMaxRoute(resolved: ResolvedStatblock | null | undefined, definition: ResourceDefinition, token: MaxHolder, statblockPath: string | null): MaxRoute | null {
  const linked = statblockPath !== null && token.kind === 'character' && token.statblockPath === statblockPath;
  if (!linked || token.overriddenMax?.includes(definition.key) === true) return BY_HAND;
  if (resolved === undefined) return null;
  if (resolved === null || statblockResourceValue(shownFieldsOf(resolved), definition, resolved.meanings) === null) return BY_HAND;
  // Only a field of the note itself, never a path into a value (`stats.0`)
  const path = definition.field.trim();
  const key = path.includes('.') ? undefined : matchingKey(resolved.fields, path, resolved.meanings);
  return key === undefined ? null : noteMaxRoute(resolved, key);
}
