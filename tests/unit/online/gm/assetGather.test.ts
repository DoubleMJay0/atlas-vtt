import { MAX_ASSET_BYTES, type SharedScene } from '../../../../src/app/online/protocol/index.ts';
import { describe, expect, it } from 'vitest';
import { stagedAssets } from '../../../../src/app/online/gm/assets/assetGather.ts';
import { assetIdOf } from '../../../../src/app/online/gm/assets/assetIds.ts';
import { ASSET_RANKS } from '../../../../src/app/online/gm/assets/assetUses.ts';
import { sha256Hex } from '../../../../src/app/online/gm/assetServe.ts';
import { bytesOf, publisherHarness, SALT } from './fakeAssetStore.ts';
import { sceneState, sequenced, shareHarness, token, type Sent } from './shareHarness.ts';

const scenes = (sent: readonly Sent[]): (SharedScene | null)[] => sent.flatMap(({ body }) => (body.t === 'scene' ? [body.scene] : []));
const EXPLORED = `data:image/png;base64,${btoa('explored')}`;

describe('what a scene open beside the presented one offers', () => {
  it('is the map of every level and the art of the tokens on the map that are not hidden', () => {
    const staged = stagedAssets({
      background: 'maps/ground.webp',
      levels: [{ background: 'maps/ground.webp' }, { background: 'maps/cellar.png' }, { background: null }],
      objects: {
        tokens: {
          a: { imagePath: 'art/a.webp' },
          b: { imagePath: 'art/b.png', isHidden: true },
          c: { imagePath: 'art/c.png', offMap: true },
          d: { imagePath: 'art/a.webp' },
          e: {},
        },
      },
    });
    expect(staged).toEqual([
      { path: 'maps/ground.webp', mime: 'image/webp', use: { kind: 'image', rank: ASSET_RANKS.staged } },
      { path: 'maps/cellar.png', mime: 'image/png', use: { kind: 'image', rank: ASSET_RANKS.staged } },
      { path: 'art/a.webp', mime: 'image/webp', use: { kind: 'image', rank: ASSET_RANKS.staged } },
    ]);
  });

  it('leaves out an animated map and the explored memory', () => {
    const scene = { background: 'maps/falls.webm', exploredMask: EXPLORED, objects: { tokens: {} } };
    expect(stagedAssets(scene)).toEqual([]);
  });
});

describe('what the presented scene offers', () => {
  it('is its map, the art of the tokens players see, and an animated map\'s video, larger than the GM serves itself, by id', async () => {
    const store = publisherHarness();
    const video = bytesOf(MAX_ASSET_BYTES + 1024, 5);
    store.files.set('maps/falls.webm', video);
    const poster = bytesOf(400, 1);
    const art = bytesOf(200, 2);
    const table = shareHarness(sceneState({ background: 'maps/falls.webm', exploredMask: EXPLORED, objects: { ...sceneState().objects, tokens: { t1: token('t1') } } }), new Map([['maps/falls.webm', poster], ['art/t1.webp', art]]), undefined, undefined, store.publisher.storing);
    table.share.start();
    await table.settle();
    await store.idle();
    await table.advance(1000);
    await store.advance(200);
    const scene = scenes(table.sent).at(-1);
    const videoHash = await sha256Hex(video);
    const posterHash = await sha256Hex(poster);
    expect(scene?.video).toEqual({ hash: videoHash, size: video.length, mime: 'video/webm', id: await assetIdOf(SALT, videoHash) });
    expect(scene?.map).toEqual({ hash: posterHash, size: poster.length, mime: 'image/png', id: await assetIdOf(SALT, posterHash) });
    const offered = store.client.offers.flat().map((asset) => [asset.kind, asset.size]);
    expect(offered).toEqual(expect.arrayContaining([['image', poster.length], ['image', art.length], ['video', video.length]]));
    expect(offered).toHaveLength(3);
    // The video is read from the vault to be hashed and again to go up, never kept in memory or sent through the table.
    expect(store.reads.get('maps/falls.webm')).toBe(2);
    expect(store.client.calls.filter((call) => call.bytes === video.length)).toHaveLength(1);
    expect(table.sent.some(({ body }) => body.t === 'asset-chunk')).toBe(false);
  });

  it('keeps the GM\'s own cap for a video players fetch from the GM', async () => {
    const store = publisherHarness();
    store.salt = null;
    store.files.set('maps/falls.webm', bytesOf(MAX_ASSET_BYTES + 1024, 5));
    const table = shareHarness(sceneState({ background: 'maps/falls.webm' }), new Map([['maps/falls.webm', bytesOf(400, 1)]]), undefined, undefined, store.publisher.storing);
    table.share.start();
    await table.settle();
    await store.idle();
    await table.settle();
    expect(scenes(table.sent).at(-1)).not.toHaveProperty('video');
    expect(scenes(table.sent).at(-1)?.map?.id).toBeUndefined();
  });

  it('goes again without ids once the store will not keep it, so players fetch it from the GM', async () => {
    const store = publisherHarness();
    store.client.answer = () => ({ answer: 'refused', reason: 'quota' });
    const table = shareHarness(sceneState({ objects: { ...sceneState().objects, tokens: { t1: token('t1') } } }), new Map([['maps/cave.webp', bytesOf(400, 1)], ['art/t1.webp', bytesOf(200, 2)]]), undefined, undefined, store.publisher.storing);
    table.share.start();
    await table.settle();
    await store.idle();
    await table.advance(1000);
    await store.advance(200);
    expect(scenes(table.sent).at(-1)?.map?.id).toBeDefined();
    expect(store.withdrawn).toBe(1);
    table.share.refreshAssets();
    await table.settle();
    await store.idle();
    await table.advance(1000);
    expect(scenes(table.sent).at(-1)?.map).not.toHaveProperty('id');
    const art = sequenced(table.sent, 'tokens').at(-1)?.tokens[0]?.art;
    expect(art?.hash).toBeDefined();
    expect(art).not.toHaveProperty('id');
  });
});
