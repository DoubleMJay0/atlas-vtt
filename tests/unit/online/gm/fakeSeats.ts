import type { CampaignPlayer } from '../../../../src/app/campaigns/players/playersFile.ts';
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
