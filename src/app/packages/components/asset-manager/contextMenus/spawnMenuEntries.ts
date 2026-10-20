import type { ContextMenuEntry } from '../../../../react/components/context-menu/AtlasContextMenu';
import type { AnyAsset } from '../types';
import { spawnEncounterTokens, spawnSelectedTokens, spawnTokenAsset, type SpawnContext } from '../utils/tokenSpawnService';
import { SPAWN_MULTIPLE_COUNTS } from '../utils/spawnCount';
import { t } from '../../../../i18n';

/**
 * The asset menu's ways to bring an encounter or tokens into the open scene: onto the map, onto it
 * and into the initiative tracker (a fight), or into the tracker beside the map. `onClose` closes
 * the asset manager once something was added.
 */
export function spawnMenuEntries(asset: AnyAsset, selectedAssets: AnyAsset[], spawnCtx: SpawnContext, onClose: () => void): ContextMenuEntry[] {
  const entries: ContextMenuEntry[] = [];

  // ── Spawn Encounter ───────────────────────────────────────────
  if (asset.type === 'encounters') {
    entries.push({
      type: 'item',
      label: t('am.menu.spawnEncounter'),
      icon: 'target',
      onClick: async () => {
        const ids = await spawnEncounterTokens(spawnCtx, asset);
        if (ids.length > 0) onClose();
      },
    });
    // A fight: placed as above and every creature in the tracker; or the tracker alone, beside the map
    entries.push({
      type: 'item',
      label: t('am.menu.startFight'),
      icon: 'swords',
      onClick: async () => {
        const ids = await spawnEncounterTokens(spawnCtx, asset, 'fight');
        if (ids.length > 0) onClose();
      },
    });
    entries.push({
      type: 'item',
      label: t('am.menu.encounterBeside'),
      icon: 'list-plus',
      onClick: async () => {
        const ids = await spawnEncounterTokens(spawnCtx, asset, 'beside');
        if (ids.length > 0) onClose();
      },
    });
  }

  // ── Spawn Token(s) on Map ─────────────────────────────────────
  if (asset.type === 'tokens') {
    const spawnCount = selectedAssets.filter((a) => a.type === 'tokens').length;
    entries.push({
      type: 'item',
      label: spawnCount > 1 ? t('am.menu.spawnTokens', { count: spawnCount }) : t('am.menu.spawn'),
      icon: 'map-pin',
      onClick: async () => {
        const ids = await spawnSelectedTokens(spawnCtx, selectedAssets);
        if (ids.length > 0) onClose();
      },
    });
    if (spawnCount <= 1) {
      entries.push({
        type: 'submenu',
        label: t('am.menu.spawnMultiple'),
        icon: 'copy-plus',
        children: SPAWN_MULTIPLE_COUNTS.map((count) => ({
          type: 'item' as const,
          label: t('am.menu.nTokens', { count }),
          onClick: async (): Promise<void> => {
            const ids = await spawnTokenAsset(spawnCtx, asset, count);
            if (ids.length > 0) onClose();
          },
        })),
      });
    }
    // Into the initiative tracker without a place on the map, each copy a combatant of its own
    if (spawnCount > 1) {
      entries.push({
        type: 'item',
        label: t('am.menu.addTokensToInitiative', { count: spawnCount }),
        icon: 'list-plus',
        onClick: async () => {
          const ids = await spawnSelectedTokens(spawnCtx, selectedAssets, 'beside');
          if (ids.length > 0) onClose();
        },
      });
    } else {
      entries.push({
        type: 'submenu',
        label: t('am.menu.addToInitiative'),
        icon: 'list-plus',
        children: [1, ...SPAWN_MULTIPLE_COUNTS].map((count) => ({
          type: 'item' as const,
          label: t('am.menu.nTokens', { count }),
          onClick: async (): Promise<void> => {
            const ids = await spawnTokenAsset(spawnCtx, asset, count, 'beside');
            if (ids.length > 0) onClose();
          },
        })),
      });
    }
  }

  return entries;
}
