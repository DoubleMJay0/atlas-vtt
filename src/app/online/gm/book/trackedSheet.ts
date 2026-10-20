import type { ResourceDefinition, ResourceValue } from '../../../resources/resourceTypes';
import { trackedResources } from '../../../resources/trackedResources';
import type { ResolvedStatblock } from '../../../statblocks/model/resolvedTypes';
import { withHeaderFields } from '../../../statblocks/model/templateHeader';
import { readerFor } from '../../../statblocks/values/fieldValues';
import { trackedMax, trackedValue } from '../../../statblocks/values/trackedNumbers';
import { playerAccess } from './playerAccess.ts';

/** A tracked number of a character's statblock, as its sheet holds it. */
export interface TrackedSheetValue {
  readonly definition: ResourceDefinition;
  readonly value: ResourceValue;
}

/**
 * The numbers a character's native statblock tracks that its player may see (with the field
 * their maximum is read from), each as a resource beside the collection's `definitions`, with the
 * note's maximum and the current value `held` (the token's), else where it starts. None for a
 * statblock not read yet or of no native template.
 */
export function trackedSheetValues(
  resolved: Pick<ResolvedStatblock, 'source' | 'template' | 'fields'> | null | undefined,
  definitions: readonly ResourceDefinition[],
  held: Readonly<Record<string, ResourceValue>> | undefined,
): TrackedSheetValue[] {
  const template = resolved?.source.kind === 'atlas' ? resolved.template : null;
  if (!resolved || !template) return [];
  const reader = readerFor(resolved.fields, withHeaderFields(template).fields);
  return trackedResources(template, definitions).flatMap(({ tracked, definition }): TrackedSheetValue[] => {
    // Its maximum shows too, so a field it reads that players may not see keeps it off their sheet
    if (playerAccess(template, tracked.field.key) === 'hidden' || playerAccess(template, tracked.maxField) === 'hidden') return [];
    const max = trackedMax(tracked, reader);
    return max === null ? [] : [{ definition, value: trackedValue(tracked, max, held?.[definition.key]) }];
  });
}
