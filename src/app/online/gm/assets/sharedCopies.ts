import { getLocale, t } from '../../../i18n';
import { formatByteSize } from '../../../utils/fileSize';
import type { StoreUsage } from './assetRoutes.ts';
import type { AssetStoreClient } from './storeClient.ts';

/** How long an answer of the store's usage is fresh enough that opening the panel does not ask again. */
export const USAGE_FRESH_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SharedCopiesPorts {
  readonly client: Pick<AssetStoreClient, 'usage' | 'deleteAll'>;
  /** Whether an account is signed in on this device. */
  signedIn(): boolean;
  /** The relay refused the token. */
  signedOutByServer(): void;
  /** Every shared copy was removed: a running table shares what players see again. */
  emptied(): void;
  /** Tells the GM something (Obsidian's `Notice`). */
  notify(text: string): void;
  now(): number;
}

/** What the panel says of the shared copies: what they hold, that it cannot be told now, or nothing (not asked yet, signed out). */
export type SharedView = StoreUsage | 'unknown' | null;

/** The panel's line: "Shared with players: 3.2 GB of 20 GB, oldest leaves in 12 days". */
export function sharedText(view: SharedView, now: number): string | null {
  if (view === null) return null;
  if (view === 'unknown') return t('online.sharedUnknown');
  const values = { used: formatByteSize(view.bytes, getLocale()), quota: formatByteSize(view.quota, getLocale()) };
  if (view.oldestLeavesAt === null || view.bytes === 0) return t('online.sharedUsage', values);
  const days = Math.floor((view.oldestLeavesAt - now) / DAY_MS);
  return days < 1 ? t('online.sharedUsageToday', values) : t('online.sharedUsageLeaves', { ...values, count: days });
}

/**
 * The copies the store keeps for the GM's players (ASD-46): what they hold of the account's quota,
 * asked when the table panel opens and after uploads came to rest, and the way to remove them all,
 * which the settings' "Delete shared copies on sign-out" uses too.
 */
export class SharedCopies {
  private view: SharedView = null;
  private askedAt = Number.NEGATIVE_INFINITY;
  private asking: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly ports: SharedCopiesPorts) {}

  current(): SharedView {
    return this.ports.signedIn() ? this.view : null;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Asks the store what it keeps, unless it was asked moments ago (`force` asks anyway). */
  refresh(force = false): Promise<void> {
    if (!this.ports.signedIn()) return Promise.resolve();
    if (!force && this.view !== null && this.ports.now() - this.askedAt < USAGE_FRESH_MS) return Promise.resolve();
    this.asking ??= this.ask().finally(() => (this.asking = null));
    return this.asking;
  }

  /** Removes every shared copy; whether the store did. `quiet`: the GM is told nothing (signing out). */
  async removeAll(quiet = false): Promise<boolean> {
    const removed = await this.ports.client.deleteAll();
    if (!removed.ok && removed.trouble === 'signed-out') this.ports.signedOutByServer();
    if (!quiet) this.ports.notify(t(removed.ok ? 'online.removedShared' : 'online.removeSharedFailed'));
    if (!removed.ok) return false;
    this.ports.emptied();
    await this.refresh(true);
    return true;
  }

  /** Forgets what was told: the account signed out. */
  clear(): void {
    this.view = null;
    this.askedAt = Number.NEGATIVE_INFINITY;
    this.changed();
  }

  private async ask(): Promise<void> {
    const answer = await this.ports.client.usage();
    if (!answer.ok && answer.trouble === 'signed-out') return this.ports.signedOutByServer();
    // A relay without the store has nothing to tell: the line stays away.
    this.view = answer.ok ? answer.value : answer.trouble === 'missing' ? null : 'unknown';
    this.askedAt = this.ports.now();
    this.changed();
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}
