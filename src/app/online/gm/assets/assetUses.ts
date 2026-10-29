import type { AssetKind, AssetRef } from '../../protocol/index.ts';

/** The order uploads go in: the map, the art of tokens players see, the video, handouts and texts, then the other open scenes. */
export const ASSET_RANKS = { map: 0, art: 1, video: 2, extra: 3, staged: 4 } as const;

/** What an asset is for: the kind the store keeps it as, and its place in the upload order. */
export interface AssetUse {
  readonly kind: AssetKind;
  readonly rank: number;
}

export const ASSET_USES = {
  /** A shared scene's map image (an animated map's poster). */
  map: { kind: 'image', rank: ASSET_RANKS.map },
  /** The art of a token players see: on the map, in the initiative list, as a speaker in the log, on a sheet. */
  art: { kind: 'image', rank: ASSET_RANKS.art },
  /** An explored memory too large to go inline. */
  explored: { kind: 'image', rank: ASSET_RANKS.art },
  /** An animated map's video. */
  video: { kind: 'video', rank: ASSET_RANKS.video },
  /** An image shown over the map, the world map, an image of a quest or a found note. */
  image: { kind: 'image', rank: ASSET_RANKS.extra },
  /** A quest's, a sheet's or a found note's whole text. */
  text: { kind: 'text', rank: ASSET_RANKS.extra },
} as const satisfies Record<string, AssetUse>;

/**
 * How a share hands players an asset the store keeps for them: the reference carries the id it is
 * stored under where the store can take it (the GM is signed in, it is within its kind's cap, the
 * store did not refuse it), and the asset is offered and uploaded. Without an id players ask the GM
 * for it by hash, as before.
 */
export interface AssetStoring {
  /**
   * The reference of bytes read or made here. `path`: the vault file these bytes are exactly, read
   * again for the upload instead of being kept in memory.
   */
  refOf(bytes: Uint8Array<ArrayBuffer>, mime: string, use: AssetUse, path?: string): Promise<AssetRef>;
  /** The reference of a vault file without keeping its bytes (an animated map's video); null where it cannot be read. */
  fileRef(path: string, mime: string, use: AssetUse): Promise<AssetRef | null>;
}
