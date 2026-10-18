import type { App } from 'obsidian';
import type { StoredBook } from '../../online/gm/book/bookStore';
import { RecordFiles } from '../../services/recordFiles/RecordFiles';
import { CampaignFiles } from '../CampaignFiles';
import { campaignFolderOf } from '../campaignPaths';
import { BOOKS_LAYOUT, bookIn, booksPathIn, emptyBooks, isWritable, type StoredBooks } from './booksFile';

/**
 * The campaigns' books files (`booksFile.ts`), one per campaign folder whose players keep books.
 * One per app, opened by the plugin beside the campaigns and released when it unloads.
 */
export class CampaignBooks extends RecordFiles<StoredBooks> {
  private static readonly instances = new WeakMap<App, CampaignBooks>();

  static open(app: App): CampaignBooks {
    let files = CampaignBooks.instances.get(app);
    if (!files) {
      files = new CampaignBooks(app);
      CampaignBooks.instances.set(app, files);
    }
    return files;
  }

  /** The app's campaign books once the plugin opened them; undefined before. */
  static forApp(app: App | undefined): CampaignBooks | undefined {
    return app ? CampaignBooks.instances.get(app) : undefined;
  }

  static release(app: App): void {
    CampaignBooks.instances.get(app)?.destroy();
    CampaignBooks.instances.delete(app);
  }

  private constructor(app: App) {
    super(app, BOOKS_LAYOUT);
  }

  /** Settles once the books files were read. */
  whenLoaded(): Promise<void> {
    return this.load();
  }

  /** A character's book in the campaign's file; undefined for none. */
  of(campaignId: string, characterId: string): StoredBook | undefined {
    const stored = this.entries().find((entry) => entry.id === campaignId);
    return stored ? bookIn(stored, characterId) : undefined;
  }

  /** The campaign's books file as the disk holds it now, read back through the adapter; null when it is not there or cannot be read. */
  async onDisk(campaignId: string): Promise<StoredBooks | null> {
    const path = this.pathOf(campaignId);
    if (path === null) return null;
    try {
      const read = BOOKS_LAYOUT.read(await this.app.vault.adapter.read(path));
      return read?.id === campaignId ? read : null;
    } catch {
      return null;
    }
  }

  /** Whether `change` can be made: the campaign has a books file of a format this Atlas writes, or a folder to create one in. */
  canChange(campaignId: string): boolean {
    const stored = this.entries().find((entry) => entry.id === campaignId);
    return stored ? isWritable(stored) : CampaignFiles.forApp(this.app)?.pathOf(campaignId) != null;
  }

  /**
   * Changes the campaign's books file, creating it in the campaign's folder when it has none.
   * False when the campaign has no folder or its file is of a later format.
   */
  change(campaignId: string, change: (stored: StoredBooks) => StoredBooks): boolean {
    const stored = this.entries().find((entry) => entry.id === campaignId);
    if (stored) {
      if (!isWritable(stored)) return false;
      this.update(campaignId, change);
      return true;
    }
    const campaignPath = CampaignFiles.forApp(this.app)?.pathOf(campaignId);
    if (!campaignPath) return false;
    this.createAt(booksPathIn(campaignFolderOf(campaignPath)), change(emptyBooks(campaignId)), change);
    return true;
  }
}
