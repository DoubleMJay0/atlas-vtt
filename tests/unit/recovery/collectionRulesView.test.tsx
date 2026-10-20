// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { collectionRulesView } from '../../../src/app/react/components/collection-settings/collectionRulesView';
import { useCollectionSettingsDraft } from '../../../src/app/react/components/collection-settings/useCollectionSettingsDraft';
import { draftResourceKey } from '../../../src/app/resources/resourceDefinitions';
import type { ResourceDefinition } from '../../../src/app/resources/resourceTypes';
import type { AssetService } from '../../../src/app/services/AssetService';
import type { CollectionSettings } from '../../../src/app/types/collectionSettingsTypes';

const hp: ResourceDefinition = { key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#c0392b', defeatedWhenSpent: true, visibleToPlayers: true };

function draftFor(settings: CollectionSettings) {
  const assets = { getCollectionSettings: () => settings } as unknown as AssetService;
  return renderHook(() => useCollectionSettingsDraft(assets, 'dungeon', true));
}

it('gives "Save as preset" the rules of a resource added in the dialog under the key it is saved with', () => {
  const { result } = draftFor({ conditions: [], resources: [hp] });
  const added = draftResourceKey();
  act(() => result.current.setResources([...result.current.resources, { ...hp, key: added, name: 'Hit Dice', field: 'hit_dice' }]));
  act(() => result.current.setRecovery({
    'hero-abc123': [{ id: 'long', name: 'Long rest', rules: [{ target: { kind: 'resource', key: added }, does: 'full' }] }],
  }));

  const view = collectionRulesView(result.current, [], []);
  const rule = view.systemRules.recovery?.['hero-abc123']?.[0]?.rules[0];
  expect(rule?.target).toEqual({ kind: 'resource', key: 'hit-dice' });
  expect(view.systemRules.resources?.map((resource) => resource.key)).toEqual(['hp', 'hit-dice']);
  // What the preset stores is what saving the collection stores
  expect(view.systemRules.recovery).toEqual(result.current.toSettings().recovery);
});
