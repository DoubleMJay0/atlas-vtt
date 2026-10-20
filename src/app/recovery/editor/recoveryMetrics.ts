/**
 * What a recovery button can restore on a template's card: the blocks that show a field one of the
 * collection's resources reads (a resource), the Counters blocks (counters), and the collection's
 * valued conditions, which the editor offers as chips under the card. A block that shows a number
 * no resource reads is "refused": the editor says it must be a token resource first. Pure.
 */

import { flattenReadingOrder, fieldsShownBy } from '../../statblocks/model/treeQueries';
import { shownHeaderParts } from '../../statblocks/model/templateHeader';
import type { FieldKey, StatblockTemplate, TemplateBlock } from '../../statblocks/model/templateTypes';
import type { ResourceDefinition } from '../../resources/resourceTypes';
import type { ConditionDefinition } from '../../types/collectionSettingsTypes';
import type { ConditionTarget, CountersTarget, RecoveryTarget, ResourceOrCounters, ResourceTarget } from '../recoveryTypes';

/** One metric of the card: a block that a rule can restore. */
export interface SheetMetric {
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
  byBlock: ReadonlyMap<string, SheetMetric>;
  /** Blocks that show a number no token resource reads. */
  refused: ReadonlySet<string>;
}

/** One key per metric: rules of a button match their metric by it, whatever rows a counters rule restores. */
export function metricKey(target: RecoveryTarget): string {
  switch (target.kind) {
    case 'resource': return `resource:${target.key}`;
    case 'counters': return `counters:${target.field}`;
    case 'condition': return `condition:${target.id}`;
  }
}

/** Whether a resource's field (a dotted path: `hp`, `stats.0`) is read from the template field `key`. */
function readsField(resource: ResourceDefinition, key: FieldKey): boolean {
  const path = resource.field.trim();
  return path === key || path.split('.')[0] === key;
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

/** The resource a block shows: a Track's own, else the first whose field the block reads. */
function resourceOf(block: TemplateBlock, resources: readonly ResourceDefinition[]): ResourceDefinition | undefined {
  if (block.type === 'track' && block.resource) {
    const named = resources.find((resource) => resource.key === block.resource);
    if (named) return named;
  }
  const keys = fieldsShownBy(block);
  return resources.find((resource) => keys.some((key) => readsField(resource, key)));
}

/** Whether a block shows a number: what a player might think of restoring. */
function showsNumber(block: TemplateBlock, template: StatblockTemplate): boolean {
  if (block.type === 'track' || block.type === 'metric') return true;
  const keys = new Set(fieldsShownBy(block));
  return template.fields.some((field) => keys.has(field.key) && (field.type === 'number' || field.type === 'dice'));
}

/** The metrics of `template`'s card, given the collection's resources. */
export function sheetMetrics(template: StatblockTemplate, resources: readonly ResourceDefinition[]): SheetMetrics {
  const recoverable = recoverableResources(resources);
  const blocks = [...shownHeaderParts(template).map((part) => part.block), ...flattenReadingOrder(template.layout.blocks)];
  const metrics: SheetMetric[] = [];
  const refused = new Set<string>();
  for (const block of blocks) {
    if (block.type === 'counters') {
      const target: CountersTarget = { kind: 'counters', field: block.field, rows: 'all' };
      metrics.push({ blockId: block.id, target, label: countersLabel(block, template) });
      continue;
    }
    if (block.type === 'section' || block.type === 'row' || block.type === 'tabs') continue;
    const resource = resourceOf(block, recoverable);
    if (resource) metrics.push({ blockId: block.id, target: resourceTarget(resource), label: resource.name.trim() || resource.field });
    else if (showsNumber(block, template)) refused.add(block.id);
  }
  return { metrics, byBlock: new Map(metrics.map((metric) => [metric.blockId, metric])), refused };
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
