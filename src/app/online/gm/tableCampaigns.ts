import type { App } from 'obsidian';
import { CampaignPlay } from '../../campaigns/campaignPlay';
import { CampaignPlayers } from '../../campaigns/players/CampaignPlayers';
import { TableSeats } from './campaignSeats.ts';

/** The campaigns online tables run on, as `OnlineControl` needs them. */
export interface TableCampaigns {
  /** The id of the campaign this device plays, or null. */
  playing(): string | null;
  /** The players of the campaign `campaignId` once the players files were read; null where there are none to read. */
  open(campaignId: string): Promise<TableSeats | null>;
  /** A table runs on the campaign `campaignId` from now on, or on none (null) once it ended. */
  bound(campaignId: string | null): void;
}

/** The vault's campaigns: the one this device plays, and their players files (`CampaignPlayers`). */
export function appCampaigns(app: App, bound: (campaignId: string | null) => void = () => undefined): TableCampaigns {
  return {
    playing: () => CampaignPlay.forApp(app).playing(),
    open: async (campaignId) => {
      const players = CampaignPlayers.forApp(app);
      if (players === undefined) return null;
      await players.whenLoaded();
      return new TableSeats(players, campaignId);
    },
    bound,
  };
}
