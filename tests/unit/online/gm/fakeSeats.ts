import type { CampaignRoster } from '../../../../src/app/campaigns/players/CampaignPlayers.ts';
import { emptyPlayers, isWritable, linkOf, readPlayers, withPlayer, type CampaignPlayer, type StoredPlayers } from '../../../../src/app/campaigns/players/playersFile.ts';
import { TableSeats, type PlayersFiles } from '../../../../src/app/online/gm/campaignSeats.ts';
import type { TableCampaigns } from '../../../../src/app/online/gm/tableCampaigns.ts';
import { Ownership, readOwnership, type CampaignSeats, type OwnershipData } from '../../../../src/app/online/gm/ownership.ts';

/** A campaign's players in memory: a character has one owner, as in the players file (`withCharacterOwner`). */
export class FakeSeats implements CampaignSeats {
  readonly gave: [string, string | null][] = [];
  private current: readonly CampaignPlayer[];
  private readonly listeners = new Set<() => void>();

  constructor(players: readonly { readonly id: string; readonly name: string; readonly characters?: readonly string[] }[] = []) {
    this.current = players.map((player, index) => ({ id: player.id, name: player.name, code: String(100000 + index), characters: player.characters ?? [] }));
  }

  players(): readonly CampaignPlayer[] {
    return this.current;
  }

  setOwner(characterId: string, playerId: string | null): void {
    this.gave.push([characterId, playerId]);
    this.current = this.current.map((player) => {
      const without = player.characters.filter((id) => id !== characterId);
      return { ...player, characters: player.id === playerId ? [...without, characterId] : without };
    });
    this.changed();
  }

  /** The campaign gains or loses players, as when another device's file arrives. */
  set(players: readonly CampaignPlayer[]): void {
    this.current = players;
    this.changed();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}

/** Ownership bound to a campaign of `players`, with the saved device data `data` read first. */
export function boundOwnership(players: ConstructorParameters<typeof FakeSeats>[0], data?: unknown, save: (data: OwnershipData) => void = () => undefined): Ownership {
  const ownership = new Ownership(readOwnership(data), save);
  ownership.bind(new FakeSeats(players));
  return ownership;
}

/** One campaign's players file in memory, read and written as `CampaignPlayers` does. */
export class MemoryPlayers implements PlayersFiles {
  private stored: StoredPlayers | undefined;
  private readonly listeners = new Set<() => void>();

  of(): CampaignRoster {
    const { stored } = this;
    return stored === undefined ? { link: null, players: [], writable: true } : { link: linkOf(stored), players: readPlayers(stored), writable: isWritable(stored) };
  }

  change(campaignId: string, change: (stored: StoredPlayers) => StoredPlayers): boolean {
    const stored = this.stored ?? emptyPlayers(campaignId);
    if (!isWritable(stored)) return false;
    this.stored = change(stored);
    for (const listener of [...this.listeners]) listener();
    return true;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/**
 * The campaign `c1` played, its players file in memory with these players (codes 100000, 100001, …),
 * for tables run by `OnlineControl`.
 */
export function fakeCampaigns(players: ConstructorParameters<typeof FakeSeats>[0] = []): TableCampaigns & { readonly seats: TableSeats } {
  const files = new MemoryPlayers();
  files.change('c1', (stored) => players.reduce((file, player, index) => withPlayer(file, { id: player.id, name: player.name, code: String(100000 + index), characters: player.characters ?? [] }, 0), stored));
  const seats = new TableSeats(files, 'c1');
  return { seats, playing: () => 'c1', open: () => Promise.resolve(seats), bound: () => undefined };
}
