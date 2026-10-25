/** How many pictures of the dungeon (dungeon, view and card size) keep their thumbnails. */
const KEPT_PICTURES = 2;

/**
 * Card thumbnails (one per style, or per theme), per picture of the dungeon. The newest pictures
 * keep theirs, so switching a view back finds its cards drawn; older ones close their bitmaps.
 */
export class ThumbnailCache<Card extends string = string> {
  private readonly pictures = new Map<string, Map<Card, ImageBitmap>>();

  /** The thumbnails of a picture, which becomes the newest. */
  of(picture: string): ReadonlyMap<Card, ImageBitmap> {
    const kept = this.pictures.get(picture) ?? new Map<Card, ImageBitmap>();
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
  put(picture: string, card: Card, bitmap: ImageBitmap): boolean {
    const kept = this.pictures.get(picture);
    if (!kept || kept.has(card)) {
      bitmap.close();
      return false;
    }
    kept.set(card, bitmap);
    return true;
  }

  clear(): void {
    for (const thumbnails of this.pictures.values()) this.close(thumbnails);
    this.pictures.clear();
  }

  private close(thumbnails: Map<Card, ImageBitmap>): void {
    for (const bitmap of thumbnails.values()) bitmap.close();
  }
}
