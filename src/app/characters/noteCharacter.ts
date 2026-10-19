import type { App } from 'obsidian';
import { AssetService, type TokenAsset } from '../services/AssetService';
import { playerCharacterLinking } from './playerCharacters';

/**
 * The player character whose statblock is the note at `notePath` (`playerCharacterLinking`), read
 * from the asset index as it is in memory; null where no player character links the note, or the
 * index is not read yet.
 */
export function playerCharacterOfNote(app: App, notePath: string): TokenAsset | null {
  return playerCharacterLinking(AssetService.getInstance(app).loadedTokenAssets(), notePath);
}
