import { isRecord, parseBookCover, type GmMessage } from '../protocol/index.ts';

export interface CoveredPagesPorts {
  /** Sends through the live lane: to all, or to one player. */
  sendLive(body: GmMessage, key: string, to?: string): void;
  /** Whether the relay takes `sends` frames: only then do messages to some players cost no more frames than one to all. */
  batches(): boolean;
  /** The players connected now. */
  connected(): Iterable<string>;
  /** A page's book no longer covers its map: it is sent the table's activity as it is now. */
  uncovered(player: string): void;
}

/** Whether a live message only tells of the table's activity: marks, and the places of drags under way that none of them ends. */
const isActivity = (body: GmMessage): boolean => body.t === 'marks' || (body.t === 'live' && body.tokens.every((place) => place.end !== true));

/**
 * The pages whose book covers their map (`book-cover`): they are left out of the table's activity,
 * which they would not draw (pointers, lasers and measurements, the places of drags under way), and
 * are sent the latest once the map shows again. Everything else still goes to all, a drag's end
 * included, so a covered page holds the scene as it stands. Only where the relay takes batches:
 * otherwise one message to all is cheaper than one to each page left.
 */
export class CoveredPages {
  private readonly covered = new Set<string>();

  constructor(private readonly ports: CoveredPagesPorts) {}

  /** A player's message: true when it was a cover message, so nobody else reads it. */
  receive(from: string, body: unknown): boolean {
    if (!isRecord(body) || body.t !== 'book-cover') return false;
    const message = parseBookCover(body);
    if (message?.covered === true) this.covered.add(from);
    else if (message !== null && this.covered.delete(from)) this.ports.uncovered(from);
    return true;
  }

  /** A player left the table: they say again whether they are covered when they are back. */
  playerLeft(player: string): void {
    this.covered.delete(player);
  }

  /** Sends a live message: activity to the pages the map shows on, anything else to all. */
  sendLive(body: GmMessage, key: string): void {
    if (this.covered.size === 0 || !isActivity(body) || !this.ports.batches()) return this.ports.sendLive(body, key);
    for (const player of this.ports.connected()) if (!this.covered.has(player)) this.ports.sendLive(body, key, player);
  }
}
