import { describe, expect, it } from 'vitest';
import { ASSET_CAPS, GM_LEVEL, isAssetKind, MAX_ASSET_BYTES, MAX_PROGRESS_ENTRIES, MAX_STORED_BYTES, parseAsset, parseAssetProgress, parseGmMessage, parseVideoAsset } from '../../../../src/app/online/protocol/index.ts';
import { EXPLORED_INLINE_BYTES } from '../../../../src/app/online/protocol/game.ts';

const hash = 'a'.repeat(64);
const id = 'b'.repeat(64);

describe('an asset reference with its stored id', () => {
  it('keeps the id of a reference from the asset store, and none where the GM serves it by hash', () => {
    expect(parseAsset({ hash, size: 10, mime: 'image/png', id })).toEqual({ hash, size: 10, mime: 'image/png', id });
    expect(parseAsset({ hash, size: 10, mime: 'image/png' })).toEqual({ hash, size: 10, mime: 'image/png' });
  });

  it('refuses an id that is no 64-character lowercase hex name', () => {
    expect(parseAsset({ hash, size: 10, mime: 'image/png', id: 'B'.repeat(64) })).toBeNull();
    expect(parseAsset({ hash, size: 10, mime: 'image/png', id: 'b'.repeat(63) })).toBeNull();
    expect(parseAsset({ hash, size: 10, mime: 'image/png', id: 7 })).toBeNull();
  });

  it('bounds the size by the socket cap without an id and by the store cap with one', () => {
    expect(parseVideoAsset({ hash, size: MAX_ASSET_BYTES + 1, mime: 'video/webm' })).toBeNull();
    expect(parseVideoAsset({ hash, size: MAX_ASSET_BYTES + 1, mime: 'video/webm', id })).toEqual({ hash, size: MAX_ASSET_BYTES + 1, mime: 'video/webm', id });
    expect(parseVideoAsset({ hash, size: MAX_STORED_BYTES + 1, mime: 'video/webm', id })).toBeNull();
  });

  it('names the caps of every kind the store holds', () => {
    expect(Object.keys(ASSET_CAPS).sort()).toEqual(['audio', 'book', 'image', 'text', 'tiles', 'video']);
    expect(ASSET_CAPS.video).toBe(500 * 1024 * 1024);
    expect(isAssetKind('tiles')).toBe(true);
    expect(isAssetKind('font')).toBe(false);
  });
});

describe('the GM reports how far its uploads have come', () => {
  it('reads shares between 0 and 1 by asset id', () => {
    expect(parseGmMessage({ t: 'asset-progress', shares: { [id]: 0.4, [hash]: 1 } })).toEqual({ t: 'asset-progress', shares: { [id]: 0.4, [hash]: 1 } });
    expect(parseAssetProgress({ shares: {} })).toEqual({ t: 'asset-progress', shares: {} });
  });

  it('refuses a share out of range, a name that is no id, and more entries than the cap', () => {
    expect(parseAssetProgress({ shares: { [id]: 1.5 } })).toBeNull();
    expect(parseAssetProgress({ shares: { [id]: Number.NaN } })).toBeNull();
    expect(parseAssetProgress({ shares: { map: 0.5 } })).toBeNull();
    expect(parseAssetProgress({ shares: [] })).toBeNull();
    const many = Object.fromEntries(Array.from({ length: MAX_PROGRESS_ENTRIES + 1 }, (_, index) => [index.toString(16).padStart(64, '0'), 1]));
    expect(parseAssetProgress({ shares: many })).toBeNull();
  });
});

describe('the explored memory comes inline', () => {
  const scene = 's1';
  const png = 'AAAA'.repeat(8);

  it('reads an inline PNG beside or instead of the mask reference', () => {
    expect(parseGmMessage({ t: 'explored', scene, mask: null, png })).toEqual({ t: 'explored', scene, mask: null, png });
    const mask = { hash, size: 5, mime: 'image/png' };
    expect(parseGmMessage({ t: 'explored', scene, mask, png })).toEqual({ t: 'explored', scene, mask, png });
    expect(parseGmMessage({ t: 'explored', scene, mask: null })).toEqual({ t: 'explored', scene, mask: null });
  });

  it('refuses a PNG that is no base64 or larger than the inline cap', () => {
    expect(parseGmMessage({ t: 'explored', scene, mask: null, png: 'AAA' })).toBeNull();
    expect(parseGmMessage({ t: 'explored', scene, mask: null, png: 'A!AA' })).toBeNull();
    const tooLong = 'A'.repeat(4 * Math.ceil(EXPLORED_INLINE_BYTES / 3) + 4);
    expect(parseGmMessage({ t: 'explored', scene, mask: null, png: tooLong })).toBeNull();
  });
});

describe('the GM level', () => {
  it('is 9: stored assets and the inline explored memory', () => {
    expect(GM_LEVEL).toBe(9);
  });
});
