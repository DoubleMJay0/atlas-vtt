import { describe, expect, it, vi } from 'vitest';
import { ThumbnailCache } from '../../../src/app/packages/components/dungeon-generator/thumbnailCache';

const bitmap = (): ImageBitmap => ({ close: vi.fn() }) as unknown as ImageBitmap;

describe('the style gallery’s thumbnails', () => {
  it('keeps the last two pictures and closes the bitmaps of older ones', () => {
    const cache = new ThumbnailCache();
    const first = bitmap();
    const second = bitmap();
    cache.of('a');
    expect(cache.put('a', 'night', first)).toBe(true);
    cache.of('b');
    expect(cache.put('b', 'night', second)).toBe(true);
    expect(cache.of('a').get('night')).toBe(first);
    cache.of('c');
    // 'a' was looked at last, so 'b' goes
    expect(second.close).toHaveBeenCalled();
    expect(first.close).not.toHaveBeenCalled();
    expect(cache.of('a').get('night')).toBe(first);
  });

  it('closes a thumbnail that arrives for a picture it no longer keeps, or twice', () => {
    const cache = new ThumbnailCache();
    const late = bitmap();
    expect(cache.put('gone', 'slate', late)).toBe(false);
    expect(late.close).toHaveBeenCalled();
    cache.of('a');
    cache.put('a', 'slate', bitmap());
    const again = bitmap();
    expect(cache.put('a', 'slate', again)).toBe(false);
    expect(again.close).toHaveBeenCalled();
  });

  it('closes every bitmap when cleared', () => {
    const cache = new ThumbnailCache();
    const kept = bitmap();
    cache.of('a');
    cache.put('a', 'ice', kept);
    cache.clear();
    expect(kept.close).toHaveBeenCalled();
    expect(cache.of('a').size).toBe(0);
  });
});
