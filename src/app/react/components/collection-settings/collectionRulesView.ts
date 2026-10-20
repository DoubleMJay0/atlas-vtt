import { collectionRecoveryRecord, recoveryTemplateIds } from '../../../recovery/collectionRecovery';
import { collectionStatblockRoles } from '../../../statblocks/roles/collectionStatblockRoles';
import { viewOfRules, type RulesView } from '../../../gameSystems/rulesView';
import type { DiceSet } from '../../../types/diceSetTypes';
import type { SystemPreset } from '../../../types/systemPresetTypes';
import type { CollectionSettingsDraft } from './useCollectionSettingsDraft';

/**
 * A collection's draft as its dialog shows it, with the statblock roles and recovery buttons that
 * belong to its game system as a preset holds them. Rules on resources added in the dialog aim at
 * the keys the resources are saved with, so "Save as preset" stores what saving the collection would.
 */
export function collectionRulesView(draft: CollectionSettingsDraft, presets: readonly SystemPreset[], sets: readonly DiceSet[]): RulesView {
  const rulesView = viewOfRules(draft, presets, sets);
  const recovery = collectionRecoveryRecord({ systemPresetId: draft.systemPresetId, recovery: draft.savedRecovery() }, presets);
  return {
    ...rulesView,
    systemRules: {
      ...rulesView.systemRules,
      statblockRoles: collectionStatblockRoles(draft, presets),
      // Own buttons, even none, differ from a preset's; inherited ones are written out only where there are some.
      ...((draft.recovery !== undefined || recoveryTemplateIds(recovery).length > 0) && { recovery }),
    },
  };
}
