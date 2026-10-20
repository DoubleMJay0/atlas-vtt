import { useEffect, useMemo, useState } from 'react';
import { normalizePath, type App } from 'obsidian';
import { isPlayerCharacter } from '../../../../characters/playerCharacters';
import { recoveryTemplateTabs, type RecoveryTemplateTab } from '../../../../recovery/editor/recoveryTemplateTabs';
import type { AssetService } from '../../../../services/AssetService';
import { builtInTemplate } from '../../../../statblocks/library/builtInTemplates';
import { useTemplateLibrary } from '../../../../statblocks/library/useTemplateLibrary';
import type { StatblockRole } from '../../../../statblocks/model/roleTypes';
import type { TemplateId } from '../../../../statblocks/model/templateTypes';
import { cachedTemplateId } from '../../../../statblocks/notes/statblockSource';
import type { RecoveryTemplate } from './RecoveryPane';

const NONE: readonly TemplateId[] = [];

/** The templates the notes of the collection's player characters are drawn with, read once while `active`. */
function useCharacterTemplateIds(app: App, assetService: AssetService | null, collectionId: string, active: boolean): readonly TemplateId[] {
  const [ids, setIds] = useState<readonly TemplateId[]>(NONE);
  useEffect(() => {
    if (!active || !assetService) return;
    let cancelled = false;
    assetService.getAssets(collectionId, 'token').then((assets) => {
      if (cancelled) return;
      const found = assets.flatMap((asset) => {
        if (asset.type !== 'token' || !isPlayerCharacter(asset) || !asset.statblockPath) return [];
        const file = app.vault.getFileByPath(normalizePath(asset.statblockPath));
        const templateId = file ? cachedTemplateId(app, file) : null;
        return templateId ? [templateId] : [];
      });
      setIds([...new Set(found)]);
    }).catch((error: unknown) => {
      console.error('[useRecoveryTemplates] Could not list the collection\'s player characters:', error);
    });
    return () => { cancelled = true; };
  }, [app, assetService, collectionId, active]);
  return ids;
}

export interface RecoveryTemplates {
  tabs: RecoveryTemplateTab[];
  templates: ReadonlyMap<TemplateId, RecoveryTemplate>;
}

/**
 * The templates the recovery pane offers, read while `active`: the roles' templates, the player
 * characters', and those the collection keeps buttons for (`withButtons`). The vault's templates are
 * followed as the template library changes.
 */
export function useRecoveryTemplates(
  app: App,
  assetService: AssetService | null,
  collectionId: string,
  roles: readonly StatblockRole[],
  withButtons: readonly TemplateId[],
  active: boolean,
): RecoveryTemplates {
  const characters = useCharacterTemplateIds(app, assetService, collectionId, active);
  const library = useTemplateLibrary(active ? app : null);
  const key = withButtons.join('\n');

  return useMemo(() => {
    const templates = new Map<TemplateId, RecoveryTemplate>();
    const find = (id: TemplateId): RecoveryTemplate | null => {
      const known = templates.get(id);
      if (known) return known;
      const builtIn = builtInTemplate(id);
      const entry = builtIn ? { template: builtIn.template, name: builtIn.name } : library?.templates.find((each) => each.template.id === id) ?? null;
      if (entry) templates.set(id, { template: entry.template, name: entry.name });
      return entry;
    };
    const others = [...characters, ...(key === '' ? [] : key.split('\n'))];
    const tabs = recoveryTemplateTabs(roles, others, (id) => find(id)?.name ?? null);
    return { tabs, templates };
  }, [roles, characters, key, library]);
}
