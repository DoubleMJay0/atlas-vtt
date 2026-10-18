import type { App } from 'obsidian';
import { RecordFiles } from '../../services/recordFiles/RecordFiles';
import { CampaignFiles } from '../CampaignFiles';
import { campaignFolderOf } from '../campaignPaths';
import {
  emptyPlayers, isWritable, linkOf, PLAYERS_LAYOUT, playersPathIn, readPlayers, type CampaignPlayer, type StoredPlayers,
} from './playersFile';

/** What a campaign's players file holds, as Atlas reads it. */
export interface CampaignRoster {
  /** The campaign's table code, once it has one. */
  readonly link: string | null;
  readonly players: readonly CampaignPlayer[];
  /** False for a file of a later format, which is only read. */
  readonly writable: boolean;
}

/**
 * The campaigns' players files (`playersFile.ts`), one per campaign folder that has online
 * players. One per app, opened by the plugin beside the campaigns and released when it unloads.
 */
export class CampaignPlayers extends RecordFiles<StoredPlayers> {
  private static readonly instances = new WeakMap<App, CampaignPlayers>();

  static open(app: App): CampaignPlayers {
    let files = CampaignPlayers.instances.get(app);
    if (!files) {
      files = new CampaignPlayers(app);
      CampaignPlayers.instances.set(app, files);
    }
    return files;
  }

  /** The app's campaign players once the plugin opened them; undefined before. */
  static forApp(app: App | undefined): CampaignPlayers | undefined {
    return app ? CampaignPlayers.instances.get(app) : undefined;
  }

  static release(app: App): void {
    CampaignPlayers.instances.get(app)?.destroy();
    CampaignPlayers.instances.delete(app);
  }

  private constructor(app: App) {
    super(app, PLAYERS_LAYOUT);
  }

  /** Settles once the players files were read. */
  whenLoaded(): Promise<void> {
    return this.load();
  }

  /** The campaign's link and players; none while it has no file. */
  of(campaignId: string): CampaignRoster {
    const stored = this.entries().find((entry) => entry.id === campaignId);
    return stored ? { link: linkOf(stored), players: readPlayers(stored), writable: isWritable(stored) } : { link: null, players: [], writable: true };
  }

  /**
   * Changes the campaign's players file, creating it in the campaign's folder when it has none.
   * False when the campaign has no folder or its file is of a later format.
   */
  change(campaignId: string, change: (stored: StoredPlayers) => StoredPlayers): boolean {
    const stored = this.entries().find((entry) => entry.id === campaignId);
    if (stored) {
      if (!isWritable(stored)) return false;
      this.update(campaignId, change);
      return true;
    }
    const campaignPath = CampaignFiles.forApp(this.app)?.pathOf(campaignId);
    if (!campaignPath) return false;
    this.createAt(playersPathIn(campaignFolderOf(campaignPath)), change(emptyPlayers(campaignId)), change);
    return true;
  }
}
