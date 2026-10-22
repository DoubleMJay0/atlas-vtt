import type { DungeonStyleId } from '../../../dungeons/styleCatalog';

/** How many pictures of the dungeon (dungeon, view and card size) keep their thumbnails. */
const KEPT_PICTURES = 2;

/**
 * The style gallery's thumbnails, per picture of the dungeon and style. The newest pictures keep
 * theirs, so switching a view back finds its cards drawn; older ones close their bitmaps.
 */
export class ThumbnailCache {
  private readonly pictures = new Map<string, Map<DungeonStyleId, ImageBitmap>>();

  /** The thumbnails of a picture, which becomes the newest. */
  of(picture: string): ReadonlyMap<DungeonStyleId, ImageBitmap> {
    const kept = this.pictures.get(picture) ?? new Map<DungeonStyleId, ImageBitmap>();
    this.pictures.delete(picture);
    this.pictures.set(picture, kept);
    for (const [key, thumbnails] of this.pictures) {
      if (this.pictures.size <= KEPT_PICTURES) break;
      this.close(thumbnails);
      this.pictures.delete(key);
    }
    return kept;
  }

  /** Keeps a thumbnail while its picture is kept; closes it otherwise. Whether it was kept. */
  put(picture: string, style: DungeonStyleId, bitmap: ImageBitmap): boolean {
    const kept = this.pictures.get(picture);
    if (!kept || kept.has(style)) {
      bitmap.close();
      return false;
    }
    kept.set(style, bitmap);
    return true;
  }

  clear(): void {
    for (const thumbnails of this.pictures.values()) this.close(thumbnails);
    this.pictures.clear();
  }

  private close(thumbnails: Map<DungeonStyleId, ImageBitmap>): void {
    for (const bitmap of thumbnails.values()) bitmap.close();
  }
}
