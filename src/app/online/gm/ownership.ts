import { PLAYER_ID_PATTERN, type Claim, type PlayerInfo } from '../protocol/index.ts';
import { sideOf } from '../../initiative/sides';
import type { TokenEntity } from '../../types';
import type { CampaignPlayer } from '../../campaigns/players/playersFile';

/**
 * The played campaign's players as the table sees them. The players and the characters they play
 * are the campaign's, kept in its players file, so they outlive any one table.
 */
export interface CampaignSeats {
  players(): readonly CampaignPlayer[];
  /** Gives a character (a library token's id) to a player of the campaign, or to nobody with null. */
  setOwner(characterId: string, playerId: string | null): void;
  /** Calls the listener after every change of the players; returns the way to stop. */
  onChange(listener: () => void): () => void;
}

/** What belongs to this device and not to the campaign: the tokens the GM gave to players and the scenes' player tokens, as saved in the companion's data. */
export interface OwnershipData {
  /** The owner of each token placed from no library token, by token id. */
  readonly owners: Readonly<Record<string, string>>;
  /**
   * Per scene (its map path), the tokens the GM made player tokens (true) or the GM's own (false);
   * every other token is a player token when it is on the players' side (`sideOf`: it sees).
   */
  readonly playerTokens: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
}

/** A player token of a scene, or a token a player was given, with its owner if it has one. */
export interface SeatInfo {
  readonly tokenId: string;
  readonly owner: KnownPlayer | null;
}

/** What a token's owner is read by: the library token it was placed from, if any. */
export type OwnedToken = Pick<TokenEntity, 'assetId'>;

/** A player in the GM's list. */
export interface KnownPlayer extends PlayerInfo {
  readonly online: boolean;
}

const MAX_TOKEN_ID = 200;
const MAX_MAP_PATH = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Ownership read from saved data: owners with a valid player id and the marks. Players and characters older versions kept here are the campaign's now and are dropped. */
export function readOwnership(data: unknown): OwnershipData {
  const record = isRecord(data) ? data : {};
  const playerTokens: Record<string, Record<string, boolean>> = {};
  for (const [mapPath, marks] of Object.entries(isRecord(record.playerTokens) ? record.playerTokens : {})) {
    if (mapPath.length > MAX_MAP_PATH || !isRecord(marks)) continue;
    const kept = Object.entries(marks).filter((entry): entry is [string, boolean] => entry[0].length <= MAX_TOKEN_ID && typeof entry[1] === 'boolean');
    if (kept.length > 0) playerTokens[mapPath] = Object.fromEntries(kept);
  }
  return { owners: ownersIn(record.owners), playerTokens };
}

/** Saved owners by token id whose owner has a valid player id. */
function ownersIn(field: unknown): Record<string, string> {
  const owners: Record<string, string> = {};
  for (const [key, owner] of Object.entries(isRecord(field) ? field : {})) {
    if (key.length <= MAX_TOKEN_ID && typeof owner === 'string' && PLAYER_ID_PATTERN.test(owner)) owners[key] = owner;
  }
  return owners;
}

/** Whether a token is a player token by default: it is on the players' side, as Atlas's initiative and lighting take it (`sideOf`). */
export const isPlayerSide = (token: TokenEntity): boolean => sideOf(token) === 'players';

/**
 * The table's players, token owners and player tokens. The players and their characters are the
 * played campaign's (`CampaignSeats`, bound when a table starts) and stay when a table ends; this
 * tracks who is online. A token has at most one owner: the player the GM gave it to; players take
 * none themselves. As Foundry's actors do, a character is owned and not one placed token: giving a
 * token placed from a library token gives every token placed from it, on every scene, so a player
 * keeps their character when the GM moves to another scene. Which tokens are player tokens the GM
 * decides per scene, and the rest follow the players' side. The owners of tokens placed from no
 * library token and the player tokens are saved through `save` whenever they change.
 */
export class Ownership {
  private campaign: CampaignSeats | null = null;
  private stopSeats: () => void = () => undefined;
  /** The campaign's characters by library token id with their owner, read from the seats until they change. */
  private characters: ReadonlyMap<string, string> | null = null;
  /** The campaign's players' names by id, read from the seats until they change. */
  private names: ReadonlyMap<string, string> | null = null;
  /** Owners of tokens placed from no library token, by token id. */
  private readonly owners = new Map<string, string>();
  /** The GM's marks by map path, then token id: true for a player token, false for the GM's own. */
  private readonly marks = new Map<string, Map<string, boolean>>();
  private readonly online = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private readonly save: (data: OwnershipData) => void;

  constructor(data: OwnershipData, save: (data: OwnershipData) => void) {
    this.save = save;
    for (const [tokenId, owner] of Object.entries(data.owners)) this.owners.set(tokenId, owner);
    for (const [mapPath, marks] of Object.entries(data.playerTokens)) this.marks.set(mapPath, new Map(Object.entries(marks)));
  }

  toData(): OwnershipData {
    return {
      owners: Object.fromEntries(this.owners),
      playerTokens: Object.fromEntries([...this.marks].map(([mapPath, marks]) => [mapPath, Object.fromEntries(marks)])),
    };
  }

  /** Calls the listener after every change; returns the way to stop. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Reads the players and characters from the played campaign's seats, or from none (null): then nobody plays and nothing can be given. */
  bind(seats: CampaignSeats | null): void {
    this.stopSeats();
    this.campaign = seats;
    this.forgetSeats();
    this.stopSeats = seats?.onChange(() => this.seatsChanged()) ?? ((): void => undefined);
    this.changed(false);
  }

  /** The relay's welcome: exactly these players are connected. */
  welcome(players: readonly PlayerInfo[]): void {
    this.online.clear();
    for (const player of players) this.online.add(player.id);
    this.changed(false);
  }

  joined(player: PlayerInfo): void {
    this.online.add(player.id);
    this.changed(false);
  }

  left(id: string): void {
    if (this.online.delete(id)) this.changed(false);
  }

  /** Forgets that a player the GM removed from the table is online; they stay in the campaign with their characters. */
  remove(id: string): void {
    if (this.online.delete(id)) this.changed(false);
  }

  /**
   * Gives the tokens `tokenIds` of a scene's `tokens` to a player of the campaign, or to nobody with
   * null. A token placed from a library token gives its character, so every token placed from it
   * follows. Without a campaign nothing is given.
   */
  give(tokenIds: readonly string[], tokens: Readonly<Record<string, OwnedToken>>, playerId: string | null): void {
    if (this.campaign === null || (playerId !== null && this.nameOf(playerId) === null)) return;
    this.setOwners(tokenIds, tokens, playerId);
    this.changed(true);
  }

  /** The owner of a token: its character's, else (a token placed from no library token) its own. */
  ownerOf(tokenId: string, token: OwnedToken | undefined): string | undefined {
    const assetId = token?.assetId;
    const owner = (assetId === undefined ? undefined : this.characterOwners().get(assetId)) ?? this.owners.get(tokenId);
    return owner === undefined || this.nameOf(owner) === null ? undefined : owner;
  }

  /** Whether a token of the scene at `mapPath` is a player token: as the GM marked it, else by its side. */
  isPlayerToken(mapPath: string, tokenId: string, token: TokenEntity): boolean {
    return this.marks.get(mapPath)?.get(tokenId) ?? isPlayerSide(token);
  }

  /** Makes tokens of a scene player tokens, or the GM's own (`false`), which also takes them back from their owners. */
  markPlayerTokens(mapPath: string, tokenIds: readonly string[], tokens: Readonly<Record<string, OwnedToken>>, player: boolean): void {
    if (mapPath.length > MAX_MAP_PATH) return;
    const marks = this.marks.get(mapPath) ?? new Map<string, boolean>();
    const marked = tokenIds.filter((tokenId) => tokenId.length <= MAX_TOKEN_ID);
    for (const tokenId of marked) marks.set(tokenId, player);
    if (!player) this.setOwners(marked, tokens, null);
    if (marks.size > 0) this.marks.set(mapPath, marks);
    this.changed(true);
  }

  /**
   * What players may know of a token: `taken` for a player token or one a player was given, null for
   * the GM's own. Never `open`: older pages offered such a token to claim, and only the GM gives tokens.
   */
  claimOf(mapPath: string, tokenId: string, token: TokenEntity): Claim {
    return this.ownerOf(tokenId, token) !== undefined || this.isPlayerToken(mapPath, tokenId, token) ? 'taken' : null;
  }

  /** The player tokens of a scene and the tokens players were given there, each with its owner, in the scene's order. */
  seats(mapPath: string, tokens: Readonly<Record<string, TokenEntity>>): SeatInfo[] {
    const players = new Map(this.list().map((player) => [player.id, player]));
    return Object.entries(tokens).flatMap(([tokenId, token]): SeatInfo[] => {
      const owner = this.ownerOf(tokenId, token);
      if (owner === undefined && !this.isPlayerToken(mapPath, tokenId, token)) return [];
      return [{ tokenId, owner: owner === undefined ? null : players.get(owner) ?? null }];
    });
  }

  /** The ids of the players connected now. */
  onlinePlayers(): string[] {
    return [...this.online];
  }

  /** The name a player of the campaign goes by, or null for anyone else. */
  nameOf(playerId: string): string | null {
    this.names ??= new Map((this.campaign?.players() ?? []).map((player) => [player.id, player.name]));
    return this.names.get(playerId) ?? null;
  }

  /** Every player of the campaign: those online first, then by name. */
  list(): KnownPlayer[] {
    return (this.campaign?.players() ?? [])
      .map(({ id, name }) => ({ id, name, online: this.online.has(id) }))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  }

  private characterOwners(): ReadonlyMap<string, string> {
    this.characters ??= new Map((this.campaign?.players() ?? []).flatMap((player) => player.characters.map((characterId): [string, string] => [characterId, player.id])));
    return this.characters;
  }

  private seatsChanged(): void {
    this.forgetSeats();
    this.changed(false);
  }

  private forgetSeats(): void {
    this.characters = null;
    this.names = null;
  }

  /**
   * Sets or (null) clears the owner of tokens: their character's, else their own; an owner a token
   * had by its own id goes. Each character is written once, however many of the tokens it placed.
   */
  private setOwners(tokenIds: readonly string[], tokens: Readonly<Record<string, OwnedToken>>, playerId: string | null): void {
    const characters = new Set<string>();
    for (const tokenId of tokenIds) {
      const assetId = tokens[tokenId]?.assetId;
      if (assetId === undefined) setIn(this.owners, tokenId, playerId);
      else {
        this.owners.delete(tokenId);
        characters.add(assetId);
      }
    }
    for (const assetId of characters) this.campaign?.setOwner(assetId, playerId);
    if (characters.size > 0) this.characters = null;
  }

  private changed(persist: boolean): void {
    if (persist) this.save(this.toData());
    for (const listener of this.listeners) listener();
  }
}

/** Sets or (null) clears the owner under `key`; a key too long to save is never set. */
function setIn(owners: Map<string, string>, key: string, playerId: string | null): void {
  if (playerId === null) owners.delete(key);
  else if (key.length <= MAX_TOKEN_ID) owners.set(key, playerId);
}
