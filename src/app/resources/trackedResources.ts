/**
 * A template's tracked numbers as resources of the character, beside its collection's: what the
 * DM screen lists, a rest restores and a player steps on their sheet. They have no socket and are
 * never drawn on the map; a number a collection resource already reads is that resource. Pure.
 */

import type { FieldKey, StatblockTemplate } from '../statblocks/model/templateTypes';
import { trackedNumbers, type TrackedNumber } from '../statblocks/values/trackedNumbers';
import { normalizedKey } from './resourceFields';
import type { ResourceDefinition } from './resourceTypes';

export interface TrackedResource {
  readonly tracked: TrackedNumber;
  readonly definition: ResourceDefinition;
}

/** Tracked numbers have no colour of their own on a card; this is what a gauge of them takes where one is needed. */
const TRACKED_COLOR = '#8a8a8a';

/**
 * Whether a resource's field (a dotted path: `hp`, `stats.0`) is read from the template field
 * `key`, as a statblock key is resolved: without case, spaces, underscores or hyphens.
 */
export function readsTemplateField(resource: ResourceDefinition, key: FieldKey): boolean {
  const wanted = normalizedKey(key);
  const path = resource.field.trim();
  return normalizedKey(path) === wanted || normalizedKey(path.split('.')[0] ?? '') === wanted;
}

/** Whether one of `resources` is the tracked number of `key` read from `field`. */
export function isCollectionResource(resources: readonly ResourceDefinition[], key: string, field: FieldKey): boolean {
  return resources.some((resource) => resource.key === key || readsTemplateField(resource, field));
}

/** The template's tracked numbers no resource of `resources` reads or shares a key with, each as a resource. */
export function trackedResources(template: StatblockTemplate, resources: readonly ResourceDefinition[]): TrackedResource[] {
  return trackedNumbers(template)
    .filter((tracked) => !isCollectionResource(resources, tracked.key, tracked.field.key))
    .map((tracked) => ({
      tracked,
      definition: {
        key: tracked.key,
        name: tracked.field.label.trim() || tracked.field.key,
        field: tracked.maxField,
        direction: tracked.counts === 'down' ? 'drains' : 'fills',
        color: TRACKED_COLOR,
        // The character's own player sees them on their sheet; the table at large does not.
        visibleToPlayers: false,
      },
    }));
}
