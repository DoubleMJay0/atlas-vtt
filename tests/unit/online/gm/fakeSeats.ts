import type { CampaignRoster, PlayersBlock } from '../../../../src/app/campaigns/players/CampaignPlayers.ts';
import { emptyPlayers, isWritable, linkOf, readPlayers, withLink, withPlayer, type CampaignPlayer, type StoredPlayers } from '../../../../src/app/campaigns/players/playersFile.ts';
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

/**
 * One campaign's players file in memory, read and written as `CampaignPlayers` does: a change is
 * applied to the copy in memory now and, as `RecordFiles` does inside `vault.process`, applied again
 * to what the disk holds once the write lands (the next timer turn, or `flush`), whose result then
 * stands in memory too. A change that is no pure function of the file shows here as it does in Atlas.
 */
export class MemoryPlayers implements PlayersFiles {
  private stored: StoredPlayers | undefined;
  private disk: StoredPlayers | undefined;
  private waiting: ((stored: StoredPlayers) => StoredPlayers)[] = [];
  private readonly listeners = new Set<() => void>();

  of(): CampaignRoster {
    const { stored } = this;
    return stored === undefined ? { link: null, players: [], writable: true } : { link: linkOf(stored), players: readPlayers(stored), writable: isWritable(stored) };
  }

  change(campaignId: string, change: (stored: StoredPlayers) => StoredPlayers): boolean {
    if (this.blocked() !== null) return false;
    const stored = this.stored ?? emptyPlayers(campaignId);
    this.stored = change(stored);
    // A new file is written as memory holds it; a file on disk takes the change again.
    if (this.disk === undefined) this.disk = this.stored;
    else {
      if (this.waiting.length === 0) setTimeout(() => this.land(), 0);
      this.waiting.push(change);
    }
    this.changed();
    return true;
  }

  blocked(): PlayersBlock | null {
    return this.stored !== undefined && !isWritable(this.stored) ? 'newer' : null;
  }

  /** Lands every write that still waits. */
  flush(): void {
    this.land();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private land(): void {
    const waiting = this.waiting.splice(0);
    if (waiting.length === 0 || this.disk === undefined) return;
    this.disk = waiting.reduce((disk, change) => change(disk), this.disk);
    if (JSON.stringify(this.disk) === JSON.stringify(this.stored)) return;
    this.stored = this.disk;
    this.changed();
  }

  private changed(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** The link of the campaign `fakeCampaigns` plays. */
export const FAKE_LINK = 'b'.repeat(26);

/**
 * The campaign `c1` played, its players file in memory with these players (codes 100000, 100001, …) and its
 * link `FAKE_LINK`, for tables run by `OnlineControl`.
 */
export function fakeCampaigns(players: ConstructorParameters<typeof FakeSeats>[0] = []): TableCampaigns & { readonly seats: TableSeats; readonly files: MemoryPlayers } {
  const files = new MemoryPlayers();
  files.change('c1', (stored) => players.reduce((file, player, index) => withPlayer(file, { id: player.id, name: player.name, code: String(100000 + index), characters: player.characters ?? [] }, 0), withLink(stored, FAKE_LINK)));
  const seats = new TableSeats(files, 'c1');
  return { seats, files, playing: () => 'c1', open: () => Promise.resolve(seats), known: () => seats, bound: () => undefined };
}
