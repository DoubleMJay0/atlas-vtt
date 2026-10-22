import type { ResourceDefinition, ResourceValue } from '../../../resources/resourceTypes';
import { holdsValue, startingValue } from '../../../resources/resourceValues';
import { statblockResourceValue } from '../../../resources/statblockResourceValues';
import { flattenReadingOrder } from '../../../statblocks/model/treeQueries';
import { shownHeaderParts, withHeaderFields } from '../../../statblocks/model/templateHeader';
import type { ResolvedStatblock } from '../../../statblocks/model/resolvedTypes';
import type { TemplateBlock } from '../../../statblocks/model/templateTypes';
import { readerFor } from '../../../statblocks/values/fieldValues';
import { numericValue } from '../../../statblocks/values/numberText';
import { blockAccess, shownRecord } from './playerAccess.ts';
import type { TrackedSheetValue } from './trackedSheet.ts';

/** The tracks of a template's card that show a collection resource: those of its layout, and the header's hit points drawn as one. */
function resourceTracks(resolved: Pick<ResolvedStatblock, 'template'>): Extract<TemplateBlock, { type: 'track' }>[] {
  const template = resolved.template;
  if (!template) return [];
  const header = shownHeaderParts(template).flatMap((part) => (part.id === 'hp' ? [part.block] : []));
  return [...header, ...flattenReadingOrder(template.layout.blocks)]
    .filter((block): block is Extract<TemplateBlock, { type: 'track' }> => block.type === 'track' && block.resource !== undefined && blockAccess(template, block) !== 'hidden');
}

/**
 * The collection resources the character's template places on its card (a Track bound to one, the
 * header's hit points drawn as one) that its token holds no value of: every gauge the template
 * places is part of the sheet, whether or not the token was given the resource or the scene shows
 * its bar. Each starts where the statblock starts it (`statblockResourceValue`), else full or empty
 * at the track's own number, and is the player's to change unless it is a fixed value. Its first
 * change gives the token the resource (`ResourceWrites` with the value offered). None for a
 * statblock not read yet or of no native template.
 */
export function placedSheetValues(
  resolved: Pick<ResolvedStatblock, 'source' | 'template' | 'fields' | 'meanings'> | null | undefined,
  definitions: readonly ResourceDefinition[],
  held: Readonly<Record<string, ResourceValue>> | undefined,
): TrackedSheetValue[] {
  const template = resolved?.source.kind === 'atlas' ? resolved.template : null;
  if (!resolved || !template) return [];
  const { fields } = withHeaderFields(template);
  const visible = shownRecord(resolved.fields, template, fields);
  const reader = readerFor(visible, fields);
  const placed = new Map<string, TrackedSheetValue>();
  for (const track of resourceTracks(resolved)) {
    const definition = definitions.find((each) => each.key === track.resource);
    const holding = definition && held?.[definition.key];
    if (!definition || placed.has(definition.key) || (holding && holdsValue(definition, holding))) continue;
    const max = numericValue(reader(track.field));
    const value = statblockResourceValue(visible, definition, resolved.meanings) ?? startingValue(definition, max !== null && max > 0 ? Math.floor(max) : 0);
    // The token holds no value of it: a maximum the player sets is its own, set by hand
    placed.set(definition.key, { definition, value, editable: definition.direction !== 'static', maxEditable: true });
  }
  return [...placed.values()];
}
