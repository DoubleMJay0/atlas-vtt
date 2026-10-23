import type { App } from 'obsidian';
import { runDungeonJob, type DungeonJob, type DungeonRendered, type DungeonWorkerMessage, type DungeonWorkerReply } from './dungeonJob';
import DungeonWorker from './dungeonWorker?worker&inline';

/** Runs a job in the window, for when no worker can start. */
export type InThreadRunner = (job: DungeonJob) => Promise<DungeonRendered>;

export interface DungeonWorkerClientOptions {
  createWorker: () => Worker;
  /** Used when the worker cannot start. */
  inThread?: InThreadRunner;
  jobTimeoutMs?: number;
}

/** Renders go first and are never dropped; a preview follows the latest; thumbnails wait for both. */
type Lane = 'render' | 'preview' | 'thumbnail';

interface Pending {
  id: number;
  job: DungeonJob;
  lane: Lane;
  /** A later preview replaced it, or its thumbnails were dropped: its result is dropped. */
  stale: boolean;
  resolve: (result: DungeonRendered | null) => void;
  reject: (reason: Error) => void;
}

/** A huge map takes a few seconds; one that has not come back after this long never will. */
const JOB_TIMEOUT_MS = 2 * 60_000;
const STOPPED = 'Drawing dungeons has stopped.';

function closeImage(result: DungeonRendered): void {
  if (result.image.type === 'bitmap') result.image.bitmap.close();
}

/**
 * The window's side of the dungeon worker: one worker per app, which generates and draws
 * dungeons off the main thread one job at a time. Previews follow the latest request: a preview
 * still queued gives way to a newer one, and one already running is answered with null.
 * Thumbnails (the style gallery's cards) run only while nothing else waits, and are answered with
 * null once dropped. A worker
 * that crashes or stops answering fails its job and is started anew for the next.
 */
export class DungeonWorkerClient {
  private static readonly instances = new WeakMap<App, DungeonWorkerClient>();

  static forApp(app: App): DungeonWorkerClient {
    let client = DungeonWorkerClient.instances.get(app);
    if (!client) {
      client = DungeonWorkerClient.standalone('Atlas dungeons');
      DungeonWorkerClient.instances.set(app, client);
    }
    return client;
  }

  /** A client with a worker of its own, drawing in the window where no worker starts; whoever makes it disposes it. */
  static standalone(name: string): DungeonWorkerClient {
    return new DungeonWorkerClient({
      createWorker: () => new DungeonWorker({ name }),
      inThread: (job) => runDungeonJob(job),
    });
  }

  /** Stops the worker; called when the plugin unloads. */
  static release(app: App): void {
    DungeonWorkerClient.instances.get(app)?.dispose();
    DungeonWorkerClient.instances.delete(app);
  }

  private worker: Worker | null = null;
  private running: Pending | null = null;
  private readonly queue: Pending[] = [];
  private timeout: number | null = null;
  private nextId = 1;
  private disposed = false;

  constructor(private readonly options: DungeonWorkerClientOptions) {}

  /** Draws a dungeon; queued behind earlier jobs and never dropped. */
  async render(job: DungeonJob): Promise<DungeonRendered> {
    const result = await this.enqueue(job, 'render');
    if (!result) throw new Error(STOPPED);
    return result;
  }

  /** Draws a preview, or answers null once a newer preview has replaced it. */
  preview(job: DungeonJob): Promise<DungeonRendered | null> {
    this.drop('preview');
    return this.enqueue(job, 'preview');
  }

  /** Draws a thumbnail once no render or preview waits, or answers null once dropped. */
  thumbnail(job: DungeonJob): Promise<DungeonRendered | null> {
    return this.enqueue(job, 'thumbnail');
  }

  /** Drops every thumbnail asked for and not yet answered: they answer null. */
  dropThumbnails(): void {
    this.drop('thumbnail');
  }

  private drop(lane: Lane): void {
    if (this.running?.lane === lane) this.running.stale = true;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i]!.lane !== lane) continue;
      this.queue.splice(i, 1)[0]!.resolve(null);
    }
  }

  /** Stops the worker and fails every job. */
  dispose(): void {
    this.disposed = true;
    this.stopWorker();
    const failed = [...(this.running ? [this.running] : []), ...this.queue.splice(0)];
    this.running = null;
    for (const pending of failed) pending.reject(new Error(STOPPED));
  }

  private enqueue(job: DungeonJob, lane: Lane): Promise<DungeonRendered | null> {
    if (this.disposed) return Promise.reject(new Error(STOPPED));
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, job, lane, stale: false, resolve, reject });
      this.pump();
    });
  }

  private pump(): void {
    if (this.running || this.disposed) return;
    const first = this.queue.findIndex(pending => pending.lane !== 'thumbnail');
    const next = this.queue.splice(first < 0 ? 0 : first, 1)[0];
    if (!next) return;
    this.running = next;
    try {
      const worker = this.startedWorker();
      if (!worker) {
        this.runInThread(next);
        return;
      }
      const message: DungeonWorkerMessage = { id: next.id, job: next.job };
      worker.postMessage(message);
    } catch (error) {
      this.settle(next, null, error instanceof Error ? error : new Error(String(error)));
      return;
    }
    this.timeout = window.setTimeout(() => this.crash('Drawing the dungeon took too long.'), this.options.jobTimeoutMs ?? JOB_TIMEOUT_MS);
  }

  /** The running worker, started where there is none; null when none can start. */
  private startedWorker(): Worker | null {
    if (this.worker) return this.worker;
    let worker: Worker;
    try {
      worker = this.options.createWorker();
    } catch (error) {
      if (!this.options.inThread) throw error;
      console.warn('[Atlas] The dungeon worker could not start; dungeons are drawn in the window', error);
      return null;
    }
    worker.addEventListener('message', (event: MessageEvent<DungeonWorkerReply>) => this.answer(event.data));
    worker.addEventListener('error', (event: ErrorEvent) => {
      event.preventDefault();
      this.crash(event.message || 'The dungeon worker stopped unexpectedly.');
    });
    worker.addEventListener('messageerror', () => this.crash('Could not read the dungeon worker’s reply.'));
    this.worker = worker;
    return worker;
  }

  private runInThread(pending: Pending): void {
    this.options.inThread!(pending.job).then(
      (result) => this.settle(pending, result, null),
      (error: unknown) => this.settle(pending, null, error instanceof Error ? error : new Error(String(error))),
    );
  }

  private answer(reply: DungeonWorkerReply): void {
    const pending = this.running;
    if (!pending || pending.id !== reply.id) {
      if (reply.ok) closeImage(reply.result);
      return;
    }
    this.clearTimeout();
    if (reply.ok) this.settle(pending, reply.result, null);
    else this.settle(pending, null, new Error(reply.message));
  }

  private settle(pending: Pending, result: DungeonRendered | null, error: Error | null): void {
    if (this.running === pending) this.running = null;
    if (pending.stale) {
      // Nobody waits for a replaced preview or a dropped thumbnail, whatever became of it
      if (result) closeImage(result);
      pending.resolve(null);
    } else if (error) pending.reject(error);
    else pending.resolve(result);
    this.pump();
  }

  /** Fails the running job and stops its worker; the next job starts a new one. */
  private crash(message: string): void {
    this.stopWorker();
    const pending = this.running;
    if (pending) this.settle(pending, null, new Error(message));
  }

  private stopWorker(): void {
    this.clearTimeout();
    this.worker?.terminate();
    this.worker = null;
  }

  private clearTimeout(): void {
    if (this.timeout === null) return;
    window.clearTimeout(this.timeout);
    this.timeout = null;
  }
}
