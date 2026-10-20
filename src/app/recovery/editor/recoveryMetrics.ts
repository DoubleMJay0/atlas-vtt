/**
 * What a recovery button can restore on a template's card: the numbers the template tracks and the
 * blocks that show a field one of the collection's resources reads (a resource), each number of a
 * Metric on its own, the Counters blocks (counters), and the collection's valued conditions, which
 * the editor offers as chips under the card. A number neither is "refused": the editor says to
 * track it in the template. Pure.
 */

import { flattenReadingOrder, fieldsShownBy } from '../../statblocks/model/treeQueries';
import { shownHeaderParts } from '../../statblocks/model/templateHeader';
import type { FieldKey, StatblockTemplate, TemplateBlock } from '../../statblocks/model/templateTypes';
import { readsTemplateField, trackedResources } from '../../resources/trackedResources';
import type { ResourceDefinition } from '../../resources/resourceTypes';
import type { ConditionDefinition } from '../../types/collectionSettingsTypes';
import type { ConditionTarget, CountersTarget, RecoveryTarget, ResourceOrCounters, ResourceTarget } from '../recoveryTypes';

/** One metric of the card: a block, or one number of a Metric, that a rule can restore. */
export interface SheetMetric {
  /** Its spot: the block's id, or `numberSpotId` for a Metric's number. */
  spotId: string;
  /** The block it is drawn by. */
  blockId: string;
  target: ResourceOrCounters;
  /** How the editor names it: the resource's name, the Counters block's label. */
  label: string;
}

/** A valued condition offered as a chip under the card. */
export interface ConditionMetric {
  target: ConditionTarget;
  label: string;
  color: string;
}

export interface SheetMetrics {
  /** In reading order: the header, then the layout. */
  metrics: readonly SheetMetric[];
  bySpot: ReadonlyMap<string, SheetMetric>;
  /** Spots of numbers no resource reads and no template tracks. */
  refused: ReadonlySet<string>;
}

/** The spot of one number of a Metric block. */
export const numberSpotId = (blockId: string, key: FieldKey): string => `${blockId}:${key}`;

/** One key per metric: rules of a button match their metric by it, whatever rows a counters rule restores. */
export function metricKey(target: RecoveryTarget): string {
  switch (target.kind) {
    case 'resource': return `resource:${target.key}`;
    case 'counters': return `counters:${target.field}`;
    case 'condition': return `condition:${target.id}`;
  }
}

/** The resources a recovery can restore: every one that counts, never a static value. */
export function recoverableResources(resources: readonly ResourceDefinition[]): ResourceDefinition[] {
  return resources.filter((resource) => resource.direction !== 'static' && resource.field.trim() !== '');
}

function resourceTarget(resource: ResourceDefinition): ResourceTarget {
  return { kind: 'resource', key: resource.key };
}

function countersLabel(block: TemplateBlock & { type: 'counters' }, template: StatblockTemplate): string {
  return block.label ?? template.fields.find((field) => field.key === block.field)?.label ?? block.field;
}

/** Whether a field holds a number: what a player might think of restoring. */
function isNumberField(template: StatblockTemplate, key: FieldKey): boolean {
  return template.fields.some((field) => field.key === key && (field.type === 'number' || field.type === 'dice'));
}

/**
 * The resource each field is: the template's tracked numbers, then the collection resources that
 * count and read it (a static one keeps the field from being tracked, and from being restored).
 */
function resourceOfField(template: StatblockTemplate, resources: readonly ResourceDefinition[]): (key: FieldKey) => ResourceDefinition | undefined {
  const tracked = new Map(trackedResources(template, resources).map((each) => [each.tracked.field.key, each.definition]));
  const recoverable = recoverableResources(resources);
  return (key) => tracked.get(key) ?? recoverable.find((resource) => readsTemplateField(resource, key));
}

/** The metrics of `template`'s card, given the collection's resources. */
export function sheetMetrics(template: StatblockTemplate, resources: readonly ResourceDefinition[]): SheetMetrics {
  const resourceOf = resourceOfField(template, resources);
  const blocks = [...shownHeaderParts(template).map((part) => part.block), ...flattenReadingOrder(template.layout.blocks)];
  const metrics: SheetMetric[] = [];
  const refused = new Set<string>();
  const offer = (spotId: string, blockId: string, resource: ResourceDefinition | undefined, number: boolean): void => {
    if (resource) metrics.push({ spotId, blockId, target: resourceTarget(resource), label: resource.name.trim() || resource.field });
    else if (number) refused.add(spotId);
  };
  for (const block of blocks) {
    if (block.type === 'counters') {
      const target: CountersTarget = { kind: 'counters', field: block.field, rows: 'all' };
      metrics.push({ spotId: block.id, blockId: block.id, target, label: countersLabel(block, template) });
    } else if (block.type === 'metric') {
      for (const key of block.fields.filter((each) => each !== '')) {
        offer(numberSpotId(block.id, key), block.id, resourceOf(key), isNumberField(template, key));
      }
    } else if (block.type === 'track') {
      const named = block.resource ? recoverableResources(resources).find((resource) => resource.key === block.resource) : undefined;
      offer(block.id, block.id, named ?? resourceOf(block.field), true);
    } else if (block.type !== 'section' && block.type !== 'row' && block.type !== 'tabs') {
      const keys = fieldsShownBy(block);
      const resource = keys.map(resourceOf).find((each) => each !== undefined);
      offer(block.id, block.id, resource, keys.some((key) => isNumberField(template, key)));
    }
  }
  return { metrics, bySpot: new Map(metrics.map((metric) => [metric.spotId, metric])), refused };
}

/** The collection's valued conditions, the only ones a rule can step down or clear. */
export function conditionMetrics(conditions: readonly ConditionDefinition[]): ConditionMetric[] {
  return conditions
    .filter((condition) => condition.valued === true && condition.name.trim() !== '')
    .map((condition) => ({ target: { kind: 'condition', id: condition.id }, label: condition.name.trim(), color: condition.color }));
}

/** The number fields of a template, which formulas name as `@key`. */
export function numberFields(template: StatblockTemplate): Array<{ key: FieldKey; label: string }> {
  return template.fields
    .filter((field) => field.type === 'number' || field.type === 'rating')
    .map((field) => ({ key: field.key, label: field.label }));
}
