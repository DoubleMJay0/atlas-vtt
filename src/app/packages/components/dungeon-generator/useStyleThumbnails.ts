import { useEffect, useMemo, useRef, useState } from 'react';
import type { DungeonModel, DungeonRequest } from '../../../dungeons/model';
import type { DungeonView } from '../../../dungeons/style';
import { DUNGEON_STYLES, type DungeonStyleId } from '../../../dungeons/styleCatalog';
import type { DungeonJob, DungeonRendered } from '../../../dungeons/worker/dungeonJob';
import { ThumbnailCache } from './thumbnailCache';

/** Draws thumbnails off the main thread: the dungeon worker, which drops a group of them on request. */
export interface ThumbnailRenderer {
  thumbnail: (job: DungeonJob, group?: string) => Promise<DungeonRendered | null>;
  dropThumbnails: (group?: string) => void;
}

const GROUP = 'styles';

/** A card's art, in device pixels, and the device pixels per CSS pixel. */
export interface ThumbnailSize {
  width: number;
  height: number;
  ratio: number;
}

export interface ThumbnailInput {
  request: DungeonRequest;
  /** The dungeon as shown; null until it is generated. */
  model: DungeonModel | null;
  view: DungeonView;
  size: ThumbnailSize | null;
  /** Drawn first: the chosen style. */
  first: DungeonStyleId;
}

/** Tells dungeons apart within one panel, for keys. */
const serials = new WeakMap<DungeonModel, number>();
let nextSerial = 1;
function serialOf(model: DungeonModel): number {
  let serial = serials.get(model);
  if (serial === undefined) {
    serial = nextSerial++;
    serials.set(model, serial);
  }
  return serial;
}

const NONE: ReadonlyMap<DungeonStyleId, ImageBitmap> = new Map();

/**
 * The style gallery's thumbnails of the dungeon as shown, one per style, drawn by the dungeon
 * worker and its helpers after any preview, and shown together once all are drawn. A new dungeon,
 * view or card size drops the thumbnails still asked for; those already drawn are kept for the
 * last pictures, so returning to one draws nothing.
 */
export function useStyleThumbnails(renderer: ThumbnailRenderer, input: ThumbnailInput): ReadonlyMap<DungeonStyleId, ImageBitmap> {
  const cache = useRef<ThumbnailCache<DungeonStyleId> | null>(null);
  cache.current ??= new ThumbnailCache<DungeonStyleId>(DUNGEON_STYLES.map(entry => entry.id));
  const [, redraw] = useState(0);
  const { request, model, view, size, first } = input;
  const firstRef = useRef(first);
  firstRef.current = first;
  const picture = useMemo(
    () => (model && size ? `${serialOf(model)}|${size.width}x${size.height}@${size.ratio}|${JSON.stringify(view)}` : null),
    [model, size, view],
  );

  useEffect(() => {
    if (!picture || !model || !size) return undefined;
    const kept = cache.current!.of(picture);
    const missing = DUNGEON_STYLES.filter(entry => !kept.has(entry.id));
    missing.sort((a, b) => Number(b.id === firstRef.current) - Number(a.id === firstRef.current));
    let live = true;
    for (const { id, style } of missing) {
      const job: DungeonJob = { request, model, style, view, output: { kind: 'thumbnail', width: size.width, height: size.height, legibleAt: size.ratio } };
      renderer.thumbnail(job, GROUP).then((result) => {
        if (!result || result.image.type !== 'bitmap') return;
        if (cache.current!.put(picture, id, result.image.bitmap) && live) redraw(n => n + 1);
      }, (error: unknown) => {
        console.error('[Atlas] A dungeon style thumbnail could not be drawn', error);
        if (cache.current!.fail(picture, id) && live) redraw(n => n + 1);
      });
    }
    return () => {
      live = false;
      renderer.dropThumbnails(GROUP);
    };
  }, [renderer, picture, request, model, view, size]);

  useEffect(() => () => cache.current?.clear(), []);

  return picture ? cache.current.shown(picture) : NONE;
}
