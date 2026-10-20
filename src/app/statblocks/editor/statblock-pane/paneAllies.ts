import type { App } from 'obsidian';
import { isPlayerCharacter } from '../../../characters/playerCharacters';
import { characterRest } from '../../../recovery/characterRest';
import type { AllyRests } from '../../../recovery/restWrites';
import { AssetService, type TokenAsset } from '../../../services/AssetService';

/** Another player character an action may be taken for: its library token id and name. */
export interface PaneAlly {
  readonly id: string;
  readonly name: string;
}

/** The player characters a rest from the note panel may reach, and how to read each one when the rest is written. */
export interface PaneAllies {
  /** By name. */
  readonly list: readonly PaneAlly[];
  /** The ids of `list`, for `checkRest`. */
  readonly ids: ReadonlySet<string>;
  /** Each ally ready to rest, read afresh; null for anyone not in `list` or no longer readable. */
  readonly rests: AllyRests;
}

/** `asset` ready to rest, where its statblock is a native note that reads as this character (not another linking it first). */
function restOf(app: App, asset: TokenAsset): ReturnType<AllyRests> {
  if (!asset.statblockPath) return null;
  const rest = characterRest(app, asset.statblockPath);
  return rest?.asset.id === asset.id ? rest : null;
}

/**
 * The other player characters of `resting`'s collection whose statblock is a native note of their
 * own, as the asset index and the notes hold them now: whom the GM's note panel offers an action
 * taken "for another" to.
 */
export function paneAllies(app: App, resting: TokenAsset): PaneAllies {
  const candidates = AssetService.getInstance(app).loadedTokenAssets().filter((asset) => (
    isPlayerCharacter(asset) && asset.id !== resting.id && asset.collection === resting.collection
    && asset.statblockPath !== undefined && asset.statblockPath !== resting.statblockPath
  ));
  const allies = candidates
    .filter((asset) => restOf(app, asset) !== null)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const byId = new Map(allies.map((asset) => [asset.id, asset]));
  return {
    list: allies.map((asset) => ({ id: asset.id, name: asset.name })),
    ids: new Set(byId.keys()),
    rests: (id) => {
      const asset = byId.get(id);
      return asset ? restOf(app, asset) : null;
    },
  };
}
