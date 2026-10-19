import { describe, expect, it } from 'vitest';
import { BUILT_IN_SYSTEM_PRESETS } from '../../../src/app/gameSystems/builtInPresets';
import { parseSystemRules } from '../../../src/app/gameSystems/presetValidation';
import { rulesOfPreset, sameSystemRules, vanillaSystemSettings } from '../../../src/app/gameSystems/systemRules';
import {
  collectionRecovery, collectionRecoveryRecord, editedRecovery, recoveryMoved, recoveryTemplateIds, sameRecovery,
} from '../../../src/app/recovery/collectionRecovery';
import { MAX_RECOVERY_BUTTONS, type RecoveryButton, type RecoveryRecord } from '../../../src/app/recovery/recoveryTypes';
import { comparableSettings, exportedSettings, importedSettings, withPresetRecovery } from '../../../src/app/services/collectionBundle/bundleSettings';
import type { CollectionMetadata } from '../../../src/app/services/AssetService';
import { withRecoveryTemplates } from '../../../src/app/statblocks/bundles/bundleTemplateIds';
import type { SystemPreset } from '../../../src/app/types/systemPresetTypes';

const PC = 'player-character-k7m2qa';
const NPC = 'marsh-npc-p3x9ab';
const HP = { kind: 'resource', key: 'hp' } as const;
const shortRest: RecoveryButton = { id: 'short', name: 'Short rest', rules: [{ target: HP, does: 'amount', formula: '1d8' }] };
const longRest: RecoveryButton = { id: 'long', name: 'Long rest', rules: [{ target: HP, does: 'full' }] };

const dnd5e = BUILT_IN_SYSTEM_PRESETS.find((preset) => preset.name === 'D&D 5e')!;
const marshRecovery: RecoveryRecord = { [PC]: [shortRest, longRest] };
const marsh: SystemPreset = { ...dnd5e, id: 'user-marsh', name: 'Marsh', builtIn: false, rules: { ...dnd5e.rules, recovery: marshRecovery } };
const presets = [...BUILT_IN_SYSTEM_PRESETS, marsh];

describe('collectionRecovery', () => {
  it('reads the collection\'s own buttons first', () => {
    const own = { [PC]: [longRest] };
    expect(collectionRecovery({ recovery: own, systemPresetId: marsh.id }, presets, PC)).toEqual([longRest]);
    // Its own record is all it has: a template it gives none has none, whatever the preset gives
    expect(collectionRecovery({ recovery: {}, systemPresetId: marsh.id }, presets, PC)).toEqual([]);
  });

  it('reads the recorded preset\'s buttons while the collection has none of its own', () => {
    expect(collectionRecovery({ systemPresetId: marsh.id }, presets, PC)).toEqual([shortRest, longRest]);
    expect(collectionRecovery({ systemPresetId: marsh.id }, presets, NPC)).toEqual([]);
  });

  it('offers none without a system, with one that names none, or with a preset that is gone', () => {
    expect(collectionRecovery({}, presets, PC)).toEqual([]);
    expect(collectionRecovery({ systemPresetId: dnd5e.id }, presets, PC)).toEqual([]);
    expect(collectionRecovery({ systemPresetId: 'user-gone' }, presets, PC)).toEqual([]);
  });

  it('reads stored buttons strictly, and never finds what every object has', () => {
    expect(collectionRecovery({ recovery: { [PC]: [{ id: 'long', name: 'Long rest', rules: [{ does: 'heal' }] }] } }, presets, PC))
      .toEqual([{ id: 'long', name: 'Long rest', rules: [] }]);
    expect(collectionRecovery({ recovery: { [PC]: [longRest] } }, presets, 'constructor')).toEqual([]);
    // A stored value that is no record reads as none of its own
    expect(collectionRecoveryRecord({ recovery: 'long', systemPresetId: marsh.id }, presets)).toEqual(marshRecovery);
  });
});

describe('sameRecovery and editedRecovery', () => {
  it('compare buttons per template, in order, and read none as an empty record', () => {
    expect(sameRecovery(marshRecovery, structuredClone(marshRecovery))).toBe(true);
    expect(sameRecovery(marshRecovery, { [PC]: [longRest, shortRest] })).toBe(false);
    expect(sameRecovery(marshRecovery, { [PC]: [shortRest, { ...longRest, name: 'Rest' }] })).toBe(false);
    expect(sameRecovery(marshRecovery, { ...marshRecovery, [NPC]: [longRest] })).toBe(false);
    expect(sameRecovery(undefined, {})).toBe(true);
    expect(sameRecovery(undefined, { [PC]: [] })).toBe(true);
  });

  it('store nothing for an edit that ends at the system\'s buttons', () => {
    expect(editedRecovery(structuredClone(marshRecovery), marshRecovery)).toBeUndefined();
    expect(editedRecovery({}, undefined)).toBeUndefined();
    expect(editedRecovery({ [PC]: [longRest], [NPC]: [] }, marshRecovery)).toEqual({ [PC]: [longRest] });
    // Every button removed, where the system gives some, is a record of its own
    expect(editedRecovery({}, marshRecovery)).toEqual({});
  });

  it('list the templates that offer a button', () => {
    expect(recoveryTemplateIds({ [PC]: [longRest], [NPC]: [] })).toEqual([PC]);
    expect(recoveryTemplateIds(undefined)).toEqual([]);
  });
});

describe('recovery in the system rules', () => {
  const rules = rulesOfPreset(marsh);

  it('reads unset as the preset\'s, so a collection that follows its preset is unedited', () => {
    expect(sameSystemRules(marsh.rules, rules)).toBe(true);
    expect(sameSystemRules(marsh.rules, { ...rules, recovery: structuredClone(marshRecovery) })).toBe(true);
    expect(sameSystemRules(marsh.rules, { ...rules, recovery: { [PC]: [longRest] } })).toBe(false);
    expect(sameSystemRules(dnd5e.rules, { ...rulesOfPreset(dnd5e), recovery: {} })).toBe(true);
  });

  it('is never copied by rulesOfPreset and is cleared by the vanilla settings', () => {
    expect(rulesOfPreset(marsh)).not.toHaveProperty('recovery');
    expect(vanillaSystemSettings()).toHaveProperty('recovery', undefined);
  });

  it('is read from a preset file strictly, and left out where it gives no template a button', () => {
    const stored = JSON.parse(JSON.stringify(marsh.rules)) as unknown;
    expect(parseSystemRules(stored)?.recovery).toEqual(marshRecovery);
    expect(parseSystemRules({ ...dnd5e.rules, recovery: { [PC]: [] } })).not.toHaveProperty('recovery');
    expect(parseSystemRules({ ...dnd5e.rules, recovery: [longRest] })).not.toHaveProperty('recovery');
  });
});

describe('recoveryMoved', () => {
  const record: RecoveryRecord = { [PC]: [shortRest, longRest], [NPC]: [longRest] };

  it('moves a deleted template\'s buttons after those of its replacement, an id the replacement uses staying behind', () => {
    const fresh: RecoveryButton = { id: 'dawn', name: 'Dawn', rules: [] };
    expect(recoveryMoved(record, PC, NPC)).toEqual({ [NPC]: [longRest, shortRest] });
    expect(recoveryMoved({ [PC]: [fresh] }, PC, NPC)).toEqual({ [NPC]: [fresh] });
  });

  it(`keeps no more than ${MAX_RECOVERY_BUTTONS} buttons on the replacement`, () => {
    const many = (prefix: string): RecoveryButton[] => Array.from({ length: 4 }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix}${i}`, rules: [] }));
    expect(recoveryMoved({ [PC]: many('a'), [NPC]: many('b') }, PC, NPC)?.[NPC]?.map((button) => button.id))
      .toEqual(['b0', 'b1', 'b2', 'b3', 'a0', 'a1']);
  });

  it('drops the buttons without a replacement, and changes nothing where the template had none', () => {
    expect(recoveryMoved(record, PC, null)).toEqual({ [NPC]: [longRest] });
    expect(recoveryMoved(record, 'other-template-aaaaaa', NPC)).toBeUndefined();
    expect(recoveryMoved(undefined, PC, null)).toBeUndefined();
    expect(recoveryMoved(record, PC, PC)).toBeUndefined();
  });
});

describe('recovery buttons in a bundle', () => {
  const collection = (settings: CollectionMetadata['settings']): CollectionMetadata => ({ id: 'Marsh', name: 'Marsh', settings } as CollectionMetadata);

  it('compare as no edit where they are the preset\'s', () => {
    const inherited = { conditions: [], systemPresetId: marsh.id };
    expect(comparableSettings({ ...inherited, recovery: structuredClone(marshRecovery) }, presets)).toEqual(inherited);
    expect(comparableSettings({ ...inherited, recovery: { [PC]: [longRest] } }, presets)).toEqual({ ...inherited, recovery: { [PC]: [longRest] } });
    expect(comparableSettings({ conditions: [], recovery: {} })).toEqual({ conditions: [] });
  });

  it('carry the buttons a collection reads from a user preset, never a built-in\'s, and keep its own', () => {
    const inherited = { conditions: [], systemPresetId: marsh.id };
    expect(withPresetRecovery(inherited, presets)).toEqual({ ...inherited, recovery: marshRecovery });
    const own = { ...inherited, recovery: { [NPC]: [longRest] } };
    expect(withPresetRecovery(own, presets)).toBe(own);
    const builtIn = { conditions: [], systemPresetId: dnd5e.id };
    expect(withPresetRecovery(builtIn, presets)).toBe(builtIn);
    expect(exportedSettings(inherited, presets, { file: (path) => path, folder: () => undefined }).recovery).toEqual(marshRecovery);
  });

  it('come in on the templates\' ids in this vault', () => {
    const ids = new Map([[PC, 'player-character-z9z9z9']]);
    const settings = { conditions: [], recovery: { [PC]: [longRest], [NPC]: [shortRest] } };
    expect(withRecoveryTemplates(settings, ids).recovery).toEqual({ 'player-character-z9z9z9': [longRest], [NPC]: [shortRest] });
    expect(withRecoveryTemplates(settings, new Map())).toBe(settings);
    // A template moved onto an id the record names keeps the buttons it had there
    expect(withRecoveryTemplates(settings, new Map([[PC, NPC]])).recovery).toEqual({ [NPC]: [shortRest] });
    const places = { collectionId: 'Fen', paths: new Map<string, string>(), templateIds: ids };
    expect(importedSettings(collection(settings), places).recovery).toEqual({ 'player-character-z9z9z9': [longRest], [NPC]: [shortRest] });
  });
});
