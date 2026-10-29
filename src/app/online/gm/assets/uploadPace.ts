/** Requests in flight while no player is connected: the uplink is the GM's alone. */
export const IN_FLIGHT_ALONE = 4;
/** Requests in flight while players are connected and their marks flow over the same uplink. */
export const IN_FLIGHT_WITH_PLAYERS = 2;
/** Requests in flight while the socket's keep-alive takes more than twice its resting time: the uplink is full. */
export const IN_FLIGHT_SLOW = 1;
/** How far back the resting round trip looks: the least of what the keep-alive took in that time. */
export const RESTING_WINDOW_MS = 5 * 60 * 1000;
/** The longest wait before a failed request is tried again. */
export const MAX_RETRY_MS = 60_000;

/**
 * How many upload requests may be in flight: four while no player is connected, two while players are
 * (their marks and the table's frames share the GM's uplink), one while the keep-alive's round trip is
 * more than twice its resting value, the sign of an uplink the uploads fill.
 */
export function inFlight(players: number, latencyMs: number | null, restingMs: number | null): number {
  if (players === 0) return IN_FLIGHT_ALONE;
  if (latencyMs !== null && restingMs !== null && latencyMs > 2 * Math.max(1, restingMs)) return IN_FLIGHT_SLOW;
  return IN_FLIGHT_WITH_PLAYERS;
}

/** The wait before the `failures`th try again: 1, 2, 4 … seconds, at most 60. */
export function retryMs(failures: number): number {
  return Math.min(MAX_RETRY_MS, 1000 * 2 ** Math.max(0, failures - 1));
}

/** The socket's resting round trip: the least the keep-alive took within `RESTING_WINDOW_MS`. */
export class RestingLatency {
  private samples: { readonly at: number; readonly ms: number }[] = [];
  private last: number | null = null;

  /** Notes the keep-alive's last round trip; the same value again is the same sample. */
  sample(ms: number | null, now: number): void {
    if (ms === null || ms === this.last) return;
    this.last = ms;
    this.samples = [...this.samples.filter((sample) => now - sample.at <= RESTING_WINDOW_MS), { at: now, ms }];
  }

  value(): number | null {
    return this.samples.length === 0 ? null : Math.min(...this.samples.map((sample) => sample.ms));
  }

  reset(): void {
    this.samples = [];
    this.last = null;
  }
}

/** Turns for requests, as many at once as `limit` says now; a turn given back lets the next out. */
export class Slots {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: () => number) {}

  take(): Promise<() => void> {
    return new Promise((resolve) => {
      this.waiting.push(() => resolve(this.releaser()));
      this.drain();
    });
  }

  /** Lets out whoever waits where the limit grew. */
  drain(): void {
    while (this.waiting.length > 0 && this.active < this.limit()) {
      this.active += 1;
      this.waiting.shift()?.();
    }
  }

  get busy(): number {
    return this.active;
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.drain();
    };
  }
}
