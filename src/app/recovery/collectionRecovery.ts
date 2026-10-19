/**
 * Reading a collection's recovery buttons: which ones a template offers, comparing two sets,
 * and what the collection stores after an edit. As with senses and statblock roles, a collection
 * reads its preset's buttons until the GM edits them; only then does it store its own. Pure.
 */

import { sameJson } from '../statblocks/format/jsonValues';
import type { TemplateId } from '../statblocks/model/templateTypes';
import type { SystemPreset } from '../types/systemPresetTypes';
import { parseRecovery } from './parseRecovery';
import { MAX_RECOVERY_BUTTONS, type RecoveryButton, type RecoveryRecord } from './recoveryTypes';

/** What reading a collection's buttons needs of its settings; `recovery` arrives unchecked. */
export interface RecoverySettings {
  recovery?: unknown;
  systemPresetId?: string | undefined;
}

const NONE: RecoveryRecord = {};
const NO_BUTTONS: readonly RecoveryButton[] = [];

/** The buttons of the preset `systemPresetId` names; undefined where there is none or it names none. */
export function presetRecovery(systemPresetId: string | undefined, presets: readonly SystemPreset[]): RecoveryRecord | undefined {
  return parseRecovery(presets.find((preset) => preset.id === systemPresetId)?.rules.recovery);
}

/** Every template's buttons in the collection: its own where it has a record of them, else its preset's, else none. */
export function collectionRecoveryRecord(settings: RecoverySettings, presets: readonly SystemPreset[]): RecoveryRecord {
  return parseRecovery(settings.recovery) ?? presetRecovery(settings.systemPresetId, presets) ?? NONE;
}

/** The buttons statblocks of the template `templateId` offer in the collection, in order; none where it names none. */
export function collectionRecovery(settings: RecoverySettings, presets: readonly SystemPreset[], templateId: TemplateId): readonly RecoveryButton[] {
  const record = collectionRecoveryRecord(settings, presets);
  return Object.hasOwn(record, templateId) ? record[templateId]! : NO_BUTTONS;
}

/** The templates of a record that offer at least one button. */
export function recoveryTemplateIds(record: RecoveryRecord | undefined): TemplateId[] {
  return Object.keys(record ?? NONE).filter((templateId) => (record?.[templateId]?.length ?? 0) > 0);
}

/** Whether two records give every template the same buttons, ids and rule order included; none is an empty record. */
export function sameRecovery(a: RecoveryRecord | undefined, b: RecoveryRecord | undefined): boolean {
  const left = recoveryTemplateIds(a);
  const right = new Set(recoveryTemplateIds(b));
  return left.length === right.size && left.every((templateId) => right.has(templateId) && sameJson(a![templateId], b![templateId]));
}

/**
 * What the collection stores after an edit of its buttons: `next`, or nothing while it equals the
 * buttons of its game system (`system`), so an untouched collection keeps following its preset.
 */
export function editedRecovery(next: RecoveryRecord, system: RecoveryRecord | undefined): RecoveryRecord | undefined {
  return sameRecovery(next, system) ? undefined : withoutEmptyTemplates(next);
}

function withoutEmptyTemplates(record: RecoveryRecord): RecoveryRecord {
  return Object.fromEntries(recoveryTemplateIds(record).map((templateId) => [templateId, record[templateId]!]));
}

/**
 * The record once the template `from` is gone: its buttons move to `to` after those `to` already
 * offers (one whose id `to` uses stays behind, and none past `MAX_RECOVERY_BUTTONS`), or go with it
 * where there is no replacement. Undefined where `from` offers no button.
 */
export function recoveryMoved(record: RecoveryRecord | undefined, from: TemplateId, to: TemplateId | null): RecoveryRecord | undefined {
  const moving = record && Object.hasOwn(record, from) ? record[from]! : NO_BUTTONS;
  if (moving.length === 0 || to === from) return undefined;
  const rest = Object.fromEntries(Object.entries(record!).filter(([templateId]) => templateId !== from));
  if (to === null) return rest;
  const kept = Object.hasOwn(rest, to) ? rest[to]! : NO_BUTTONS;
  const taken = new Set(kept.map((button) => button.id));
  const joined = [...kept, ...moving.filter((button) => !taken.has(button.id))].slice(0, MAX_RECOVERY_BUTTONS);
  return { ...rest, [to]: joined };
}
