import type { App } from 'obsidian';
import { AssetService, type TokenAsset } from '../services/AssetService';
import { playerCharactersLinking } from './playerCharacters';

/**
 * The player character whose statblock is the note at `notePath`, read from the asset index as it
 * is in memory: of several, the first by name (`playerCharactersLinking`). Null where no player
 * character links the note, or the index is not read yet.
 */
export function playerCharacterOfNote(app: App, notePath: string): TokenAsset | null {
  return playerCharactersLinking(AssetService.getInstance(app).loadedTokenAssets(), notePath)[0] ?? null;
}
