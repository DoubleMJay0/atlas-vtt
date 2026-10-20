import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { App } from 'obsidian';
import { playerCharactersLinking } from '../../../characters/playerCharacters';
import { useExperimentalFeature } from '../../../react/hooks/useExperimentalFeature';
import { useSystemPresets } from '../../../react/hooks/useSystemPresets';
import { collectionRecovery } from '../../../recovery/collectionRecovery';
import type { RecoveryButton } from '../../../recovery/recoveryTypes';
import { AssetService, type TokenAsset } from '../../../services/AssetService';
import { SettingsService } from '../../../services/SettingsService';
import type { StatblockTemplate, TemplateId } from '../../model/templateTypes';

/** The recovery buttons the pane offers its note's player character. */
export interface PaneRecovery {
  /** The character: of several linking the note, the first by name. */
  readonly character: TokenAsset;
  /** Whether other player characters link the note too, so the pane names the one it rests. */
  readonly several: boolean;
  readonly templateId: TemplateId;
  /** The template the note is drawn with, whose fields the rest reads. */
  readonly template: StatblockTemplate;
  readonly buttons: readonly RecoveryButton[];
}

export const PaneRecoveryContext = createContext<PaneRecovery | null>(null);

/** The pane's recovery buttons; null where it offers none. */
export function usePaneRecoveryContext(): PaneRecovery | null {
  return useContext(PaneRecoveryContext);
}

/**
 * The recovery buttons beside a note (R4): only where the note is a player character's statblock,
 * the character's collection gives its template buttons, and the statblock editor is switched on.
 * Read again when the asset index changes (a token made a player character or linked) and when a
 * collection's settings are saved.
 */
export function usePaneRecovery(app: App, notePath: string, template: StatblockTemplate): PaneRecovery | null {
  // The note's panel draws outside Atlas's UI context: the switch is read from the app's settings
  const on = useExperimentalFeature('statblockEditor', SettingsService.forApp(app));
  const { presets } = useSystemPresets(app);
  const [revision, refresh] = useReducer((count: number): number => count + 1, 0);

  // The vault check and every change of a token's record end in `refresh-assets`.
  useEffect(() => {
    const refs = [app.workspace.on('atlas-vtt:refresh-assets', refresh), app.workspace.on('atlas-vtt:collection-settings-changed', refresh)];
    return () => { for (const ref of refs) app.workspace.offref(ref); };
  }, [app]);

  return useMemo((): PaneRecovery | null => {
    if (!on) return null;
    const assets = AssetService.getInstance(app);
    const [character, ...others] = playerCharactersLinking(assets.loadedTokenAssets(), notePath);
    if (!character) return null;
    const buttons = collectionRecovery(assets.getCollectionSettings(character.collection), presets, template.id);
    return buttons.length > 0 ? { character, several: others.length > 0, templateId: template.id, template, buttons } : null;
    // `revision` reads the index and the settings again after they changed.
  }, [app, on, notePath, template, presets, revision]);
}
