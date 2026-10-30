import type { App } from 'obsidian';
import { TileDecoderClient } from './TileDecoderClient';
import type { TileEvent } from './tileProtocol';

/**
 * Which map images have their tile pyramid cut right now, and how far, by
 * file path: what the quiet "Processing" signs read. A scene opens from
 * whatever the cache holds and sharpens as tiles land, so the sign says the
 * softness is temporary; it never blocks anything. The worker names the file
 * a build is for in its events (the path the map was first opened or prebuilt
 * by); a build of a file it cannot name shows no sign.
 */

export interface MapProgress {
  /** Tiles of the pyramid stored, a resumed build counting what it found. */
  done: number;
  /** Every tile of the pyramid. */
  total: number;
}

/** What the tracker hears from: `TileDecoderClient`'s events. */
export interface ProcessingSource {
  onEvent(listener: (event: TileEvent) => void): () => void;
}

export interface MapProcessingOptions {
  /** A build that sends no progress for this long has stopped (it gave way); its sign goes. */
  staleAfterMs?: number;
}

/** A build that gives way tells no one, and a resumed one starts with news; no batch of tiles takes a minute. */
const STALE_AFTER_MS = 60_000;

export class MapProcessing {
  private static readonly instances = new WeakMap<App, MapProcessing>();

  static forApp(app: App): MapProcessing {
    let processing = MapProcessing.instances.get(app);
    if (!processing) {
      processing = new MapProcessing(TileDecoderClient.forApp(app));
      MapProcessing.instances.set(app, processing);
    }
    return processing;
  }

  /** Stops listening; called when the plugin unloads. */
  static release(app: App): void {
    MapProcessing.instances.get(app)?.dispose();
    MapProcessing.instances.delete(app);
  }

  private readonly progress = new Map<string, MapProgress>();
  /** The path each hash's events named, for an end the worker sends without one. */
  private readonly pathOfHash = new Map<string, string>();
  private readonly timers = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private readonly staleAfterMs: number;
  private readonly unsubscribe: () => void;
  private disposed = false;

  constructor(source: ProcessingSource, options: MapProcessingOptions = {}) {
    this.staleAfterMs = options.staleAfterMs ?? STALE_AFTER_MS;
    this.unsubscribe = source.onEvent((event) => this.heard(event));
  }

  /** How far the pyramid of the map image at `path` is cut, or null while none is being cut; the same object until it changes. */
  stateOf(path: string): MapProgress | null {
    return this.progress.get(path) ?? null;
  }

  /** Whether any map image is being processed. */
  busy(): boolean {
    return this.progress.size > 0;
  }

  /** Called on every change; returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    for (const timer of this.timers.values()) window.clearTimeout(timer);
    this.timers.clear();
    this.progress.clear();
    this.pathOfHash.clear();
    this.listeners.clear();
  }

  private heard(event: TileEvent): void {
    const path = event.path ?? this.pathOfHash.get(event.hash);
    if (path === undefined) return;
    if (event.type === 'progress') {
      this.pathOfHash.set(event.hash, path);
      this.progress.set(path, { done: event.done, total: event.total });
      this.arm(path);
    } else {
      this.pathOfHash.delete(event.hash);
      this.end(path);
    }
    this.changed();
  }

  private end(path: string): void {
    this.progress.delete(path);
    const timer = this.timers.get(path);
    if (timer !== undefined) window.clearTimeout(timer);
    this.timers.delete(path);
  }

  private arm(path: string): void {
    const timer = this.timers.get(path);
    if (timer !== undefined) window.clearTimeout(timer);
    this.timers.set(path, window.setTimeout(() => {
      this.end(path);
      this.changed();
    }, this.staleAfterMs));
  }

  private changed(): void {
    if (this.disposed) return;
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[Atlas] A map processing listener failed:', error);
      }
    }
  }
}

/** Whole percent of `progress`, never 100 while tiles are still missing. */
export function processingPercent(progress: MapProgress): number {
  if (progress.total <= 0) return 0;
  const percent = Math.floor((progress.done / progress.total) * 100);
  return Math.min(Math.max(percent, 0), progress.done < progress.total ? 99 : 100);
}
