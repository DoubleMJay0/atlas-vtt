import { useEffect, useState } from 'react';
import { parseCreatureFilters, parseHiddenCreatureFilters } from '../../../creatures/creatureFilterDefinitions';
import { parseRecovery } from '../../../recovery/parseRecovery';
import type { RecoveryRecord } from '../../../recovery/recoveryTypes';
import { changedResourceKeys, withSavedResourceKeys } from '../../../recovery/editor/recoveryResourceKeys';
import { savedResources } from '../../../resources/resourceDefinitions';
import type { AssetService } from '../../../services/AssetService';
import type { StatblockRole, StatblockRoleFolders } from '../../../statblocks/model/roleTypes';
import {
  parseStatblockRoleFolders, parseStatblockRoles, savedRoleFolders, savedStatblockRoles,
} from '../../../statblocks/roles/roleValidation';
import type { CollectionSettings } from '../../../types/collectionSettingsTypes';
import type { CreatureFilterDefinition } from '../../../types/creatureFilterTypes';
import type { RandomTableSource, RarityOption } from '../../../types/randomTableTypes';
import type { SystemPreset } from '../../../types/systemPresetTypes';
import { useRulesDraft, type RulesDraft } from './useRulesDraft';

/** A collection's settings as edited in its dialog: its game system rules, and what it keeps beside them. */
export interface CollectionSettingsDraft extends Omit<RulesDraft, 'toSettings'> {
  /** The collection's filters on fields of its own. */
  customCreatureFilters: CreatureFilterDefinition[];
  setCustomCreatureFilters: (filters: CreatureFilterDefinition[]) => void;
  /** Ids of Atlas' own filters switched off for the collection. */
  hiddenCreatureFilters: string[];
  setHiddenCreatureFilters: (ids: string[]) => void;
  lootBases: string[];
  setLootBases: (lootBases: string[]) => void;
  lootCurrency: string;
  setLootCurrency: (lootCurrency: string) => void;
  /** The table notes as stored, entries of a newer Atlas included; change them with `withRandomTable`. */
  randomTables: readonly RandomTableSource[];
  setRandomTables: (randomTables: readonly RandomTableSource[]) => void;
  /** As stored while untouched; unset while the collection takes its system's words (`collectionItemRarities`). */
  itemRarities: readonly RarityOption[] | undefined;
  /** Set only once the GM edits the words (`editedItemRarities`), so an untouched collection keeps following its preset. */
  setItemRarities: (itemRarities: readonly RarityOption[] | undefined) => void;
  /** Unset while the collection takes the roles of its preset; read with `collectionStatblockRoles`. */
  statblockRoles: readonly StatblockRole[] | undefined;
  /** Set only once the GM edits the roles (`editedStatblockRoles`), so an untouched collection keeps following its preset. */
  setStatblockRoles: (roles: readonly StatblockRole[] | undefined) => void;
  /** The collection's own folder per role id; a preset neither sets nor clears them. */
  statblockRoleFolders: StatblockRoleFolders;
  setStatblockRoleFolders: (folders: StatblockRoleFolders) => void;
  /** Unset while the collection takes the recovery buttons of its preset; read with `collectionRecovery`. */
  recovery: RecoveryRecord | undefined;
  /** Set only once the GM edits the buttons (`editedRecovery`), so an untouched collection keeps following its preset. */
  setRecovery: (recovery: RecoveryRecord | undefined) => void;
  /** The own buttons as saving stores them: rules on a resource added in the dialog aim at the key it is saved with. */
  savedRecovery: () => RecoveryRecord | undefined;
  /** The draft as the settings to save. */
  toSettings: () => Partial<CollectionSettings>;
}

/** The collection's settings as edited in the modal; nothing is written until the caller saves. */
export function useCollectionSettingsDraft(
  assetService: AssetService | null,
  collectionId: string,
  isOpen: boolean,
): CollectionSettingsDraft {
  const rules = useRulesDraft();
  const [lootBases, setLootBases] = useState<string[]>([]);
  const [lootCurrency, setLootCurrency] = useState('');
  const [randomTables, setRandomTables] = useState<readonly RandomTableSource[]>([]);
  const [itemRarities, setItemRarities] = useState<readonly RarityOption[] | undefined>(undefined);
  const [customCreatureFilters, setCustomCreatureFilters] = useState<CreatureFilterDefinition[]>([]);
  const [hiddenCreatureFilters, setHiddenCreatureFilters] = useState<string[]>([]);
  const [statblockRoles, setStatblockRoles] = useState<readonly StatblockRole[] | undefined>(undefined);
  const [statblockRoleFolders, setStatblockRoleFolders] = useState<StatblockRoleFolders>({});
  const [recovery, setRecovery] = useState<RecoveryRecord | undefined>(undefined);
  const { load } = rules;

  useEffect(() => {
    if (!isOpen || !assetService) return;
    const settings = assetService.getCollectionSettings(collectionId);
    load(settings);
    setLootBases(settings.lootBases ?? []);
    setLootCurrency(settings.lootCurrency ?? '');
    // Kept as stored until the GM changes them, so nothing a newer Atlas wrote is lost by saving.
    setRandomTables(Array.isArray(settings.randomTables) ? settings.randomTables : []);
    setItemRarities(Array.isArray(settings.itemRarities) ? settings.itemRarities : undefined);
    setCustomCreatureFilters(parseCreatureFilters(settings.customCreatureFilters));
    setHiddenCreatureFilters(parseHiddenCreatureFilters(settings.hiddenCreatureFilters));
    // An empty list is no list of its own: the collection then reads its preset's.
    const ownRoles = parseStatblockRoles(settings.statblockRoles);
    setStatblockRoles(ownRoles?.length ? ownRoles : undefined);
    setStatblockRoleFolders(parseStatblockRoleFolders(settings.statblockRoleFolders) ?? {});
    setRecovery(parseRecovery(settings.recovery));
  }, [isOpen, collectionId, assetService, load]);

  // Rules on a resource added in this dialog follow it to the key it is saved with.
  const savedRecovery = (): RecoveryRecord | undefined =>
    recovery && withSavedResourceKeys(recovery, changedResourceKeys(rules.resources, savedResources(rules.resources)));

  return {
    ...rules,
    // The collection reads its preset's roles and recovery buttons until they are edited.
    applyPreset: (preset: SystemPreset): void => {
      rules.applyPreset(preset);
      setStatblockRoles(undefined);
      setItemRarities(undefined);
      setRecovery(undefined);
    },
    clearSystem: (): void => {
      rules.clearSystem();
      setStatblockRoles(undefined);
      setItemRarities(undefined);
      setRecovery(undefined);
    },
    customCreatureFilters, setCustomCreatureFilters,
    hiddenCreatureFilters, setHiddenCreatureFilters,
    lootBases, setLootBases,
    lootCurrency, setLootCurrency,
    randomTables, setRandomTables,
    itemRarities, setItemRarities,
    statblockRoles, setStatblockRoles,
    statblockRoleFolders, setStatblockRoleFolders,
    recovery, setRecovery,
    savedRecovery,
    toSettings: () => {
      const system = rules.toSettings();
      return {
        ...system,
        // Trimmed, with the field as label where none was typed.
        customCreatureFilters: parseCreatureFilters(customCreatureFilters),
        hiddenCreatureFilters,
        lootBases,
        lootCurrency: lootCurrency.trim() || undefined,
        randomTables: randomTables.length > 0 ? [...randomTables] : undefined,
        itemRarities,
        statblockRoles: statblockRoles?.length ? savedStatblockRoles(statblockRoles) : undefined,
        statblockRoleFolders: savedRoleFolders(statblockRoleFolders, statblockRoles),
        recovery: savedRecovery(),
      };
    },
  };
}
