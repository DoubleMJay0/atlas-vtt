/**
 * What becomes of the recovery buttons a template offers when the template is copied or deleted:
 * a copy made for one statblock offers the original's buttons in that statblock's collection; on a
 * deletion the collections' own buttons and those of saved systems move to its replacement, or go
 * with it.
 */

import type { App } from 'obsidian';
import { editedRecovery, presetRecovery, recoveryCopied, recoveryLost, recoveryMoved, recoveryTemplateIds } from '../../recovery/collectionRecovery';
import { parseRecovery } from '../../recovery/parseRecovery';
import type { RecoveryRecord } from '../../recovery/recoveryTypes';
import { AssetService } from '../../services/AssetService';
import { SystemPresetFiles } from '../../services/systemPresets/SystemPresetFiles';
import { SystemPresetService } from '../../services/SystemPresetService';
import type { TemplateId } from '../model/templateTypes';

function presetService(app: App): SystemPresetService | null {
  const files = SystemPresetFiles.forApp(app);
  return files ? new SystemPresetService(files) : null;
}

/**
 * The copy `to` of the template `from` offers the buttons `from` offers in the collection
 * `collectionId`, stored as the collection's own; nothing else of its settings changes.
 */
export async function copyRecoveryButtons(app: App, collectionId: string, from: TemplateId, to: TemplateId): Promise<void> {
  const assets = AssetService.getInstance(app);
  const recovery = recoveryCopied(assets.getCollectionSettings(collectionId), presetService(app)?.list() ?? [], from, to);
  if (recovery) await assets.updateCollectionSettings(collectionId, { recovery });
}

/** Every record of buttons that deleting a template changes: each collection's own, and each saved (not built-in) system's. */
function recoveryRecords(app: App, presets: SystemPresetService | null): (RecoveryRecord | undefined)[] {
  return [
    ...AssetService.getInstance(app).loadedCollections().map((collection) => parseRecovery(collection.settings?.recovery)),
    ...(presets?.list() ?? []).flatMap((preset) => (preset.builtIn ? [] : [preset.rules.recovery])),
  ];
}

/**
 * The names of the buttons that go with the template `from` when it is deleted for `to` (null: none),
 * each once, in the order found: all of them without a replacement, else those it has no room or id for.
 */
export function recoveryButtonsLost(app: App, from: TemplateId, to: TemplateId | null): string[] {
  const target = to === from ? null : to;
  const lost = recoveryRecords(app, presetService(app)).flatMap((record) => recoveryLost(record, from, target));
  return [...new Set(lost.map((button) => button.name))];
}

/** Recovery buttons of the template `from` move to `to` (go, without one): the collections' own and those of saved systems. */
export async function moveRecoveryButtons(app: App, from: TemplateId, to: TemplateId | null): Promise<void> {
  const assets = AssetService.getInstance(app);
  const presets = presetService(app);
  const known = presets?.list() ?? [];
  for (const collection of assets.loadedCollections()) {
    const settings = collection.settings;
    const own = parseRecovery(settings?.recovery);
    const moved = own && recoveryMoved(own, from, to);
    if (moved) await assets.updateCollectionSettings(collection.id, { recovery: editedRecovery(moved, presetRecovery(settings?.systemPresetId, known)) });
  }
  if (!presets) return;
  for (const preset of known) {
    const moved = preset.builtIn ? undefined : recoveryMoved(preset.rules.recovery, from, to);
    if (!moved) continue;
    const { recovery: _recovery, ...rules } = preset.rules;
    presets.update(preset.id, recoveryTemplateIds(moved).length > 0 ? { ...rules, recovery: moved } : rules);
  }
}
