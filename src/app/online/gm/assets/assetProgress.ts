import { MAX_PROGRESS_ENTRIES, type GmMessage } from '../../protocol/index.ts';
import type { Timers } from '../companionTimers.ts';

/** How often players hear how far the uploads came, at most. */
export const PROGRESS_INTERVAL_MS = 500;
/** How long an asset that reached 1 stays in the paced messages, so a message the live lane replaced before it left loses no completion. */
export const DONE_KEPT_MS = 5_000;
/** The key the paced messages share in the live lane: a newer one replaces one that still waits. */
const LIVE_KEY = 'asset-progress';

export interface ProgressPorts {
  /** Sends ahead of other frames, the newest of a key replacing one that waits. */
  sendLive(body: GmMessage, key: string, to?: string): void;
  send(body: GmMessage, to?: string): void;
  readonly timers: Timers;
}

/** Shares as messages of at most `MAX_PROGRESS_ENTRIES` each. */
function messagesOf(entries: readonly (readonly [string, number])[]): GmMessage[] {
  const messages: GmMessage[] = [];
  for (let start = 0; start < entries.length; start += MAX_PROGRESS_ENTRIES) {
    messages.push({ t: 'asset-progress', shares: Object.fromEntries(entries.slice(start, start + MAX_PROGRESS_ENTRIES)) });
  }
  return messages;
}

/**
 * How far each asset players were handed has come on its way into the store (0 to 1, where 1 means it
 * can be fetched), told to every player (`asset-progress`): paced at `PROGRESS_INTERVAL_MS` through the
 * live lane while anything moves, with a last message saying 1, and every share again, whole, after a
 * reconnect and to a player who joins. Only ids players were handed are ever named: an id is the right
 * to read the object.
 */
export class AssetProgress {
  private readonly shares = new Map<string, number>();
  /** When each asset reached 1, while it is still named in the paced messages. */
  private readonly doneAt = new Map<string, number>();
  private readonly changed = new Set<string>();
  private timer: number | undefined;
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly ports: ProgressPorts) {}

  /** Sets an asset's share; told to players within `PROGRESS_INTERVAL_MS` where it changed. */
  set(id: string, share: number): void {
    const clamped = Math.min(1, Math.max(0, share));
    if (this.shares.get(id) === clamped) return;
    this.shares.set(id, clamped);
    if (clamped === 1) this.doneAt.set(id, this.ports.timers.now());
    else this.doneAt.delete(id);
    this.changed.add(id);
    this.schedule();
  }

  share(id: string): number | undefined {
    return this.shares.get(id);
  }

  /** Forgets an asset: it is named no more. */
  delete(id: string): void {
    this.shares.delete(id);
    this.doneAt.delete(id);
    this.changed.delete(id);
  }

  /** Every share, whole, to one player or to all. */
  resend(to?: string): void {
    for (const message of messagesOf([...this.shares])) this.ports.send(message, to);
  }

  stop(): void {
    if (this.timer !== undefined) this.ports.timers.clearTimer(this.timer);
    this.timer = undefined;
  }

  private schedule(): void {
    if (this.timer !== undefined) return;
    const wait = Math.max(0, this.lastAt + PROGRESS_INTERVAL_MS - this.ports.timers.now());
    this.timer = this.ports.timers.setTimer(() => {
      this.timer = undefined;
      this.flush();
    }, wait);
  }

  /** What moves now: every asset not yet there, and those that got there lately; nothing when nothing changed. */
  private flush(): void {
    if (this.changed.size === 0) return;
    const now = this.ports.timers.now();
    this.lastAt = now;
    this.changed.clear();
    for (const [id, at] of [...this.doneAt]) if (now - at > DONE_KEPT_MS) this.doneAt.delete(id);
    const moving = [...this.shares].filter(([id, share]) => share < 1 || this.doneAt.has(id));
    const [first, ...rest] = messagesOf(moving);
    if (first !== undefined) this.ports.sendLive(first, LIVE_KEY);
    for (const message of rest) this.ports.send(message);
  }
}
