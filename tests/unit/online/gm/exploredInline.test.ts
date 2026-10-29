import { EXPLORED_INLINE_BYTES, parseGmMessage, type GmMessage } from '../../../../src/app/online/protocol/index.ts';
import { describe, expect, it } from 'vitest';
import { assetIdOf } from '../../../../src/app/online/gm/assets/assetIds.ts';
import { EXPLORED_INTERVAL_MS } from '../../../../src/app/online/gm/InputShare.ts';
import { sha256Hex, toBase64 } from '../../../../src/app/online/gm/assetServe.ts';
import { bytesOf, publisherHarness, SALT } from './fakeAssetStore.ts';
import { sceneState, shareHarness } from './shareHarness.ts';

type Explored = Extract<GmMessage, { t: 'explored' }>;

/** A lit scene whose explored memory is `mask`, shared with a store; the explored messages players got. */
async function exploredSent(mask: Uint8Array<ArrayBuffer>): Promise<{ readonly sent: Explored[]; readonly store: ReturnType<typeof publisherHarness>; readonly table: ReturnType<typeof shareHarness> }> {
  const store = publisherHarness();
  const table = shareHarness(sceneState({ lighting: { enabled: true, ambient: 0.2 }, exploredMask: `data:image/png;base64,${toBase64(mask)}` }), new Map([['maps/cave.webp', bytesOf(300, 1)]]), undefined, undefined, store.publisher.storing);
  table.share.start();
  await table.settle();
  await table.advance(EXPLORED_INTERVAL_MS + 100);
  await store.idle();
  await table.settle();
  await store.advance(200);
  return { sent: table.sent.flatMap(({ body }) => (body.t === 'explored' ? [body] : [])), store, table };
}

describe('the explored memory', () => {
  it('goes inline as a PNG where it is small, with its reference beside it for pages that fetch it', async () => {
    const mask = bytesOf(5000, 3);
    const { sent, store } = await exploredSent(mask);
    const hash = await sha256Hex(mask);
    expect(sent.at(-1)).toMatchObject({ mask: { hash, size: mask.length, mime: 'image/png' }, png: toBase64(mask) });
    expect(sent.at(-1)?.mask).not.toHaveProperty('id');
    // Players read it as the protocol has it.
    const read = parseGmMessage(JSON.parse(JSON.stringify(sent.at(-1))));
    expect(read).toMatchObject({ t: 'explored', png: toBase64(mask) });
    // Never offered to the store.
    expect(store.client.offers.flat().some((asset) => asset.size === mask.length)).toBe(false);
  });

  it('goes by reference alone where it is larger than goes inline, stored under its id', async () => {
    const mask = bytesOf(EXPLORED_INLINE_BYTES + 1, 4);
    const { sent, store, table } = await exploredSent(mask);
    const hash = await sha256Hex(mask);
    expect(sent.at(-1)?.mask).toEqual({ hash, size: mask.length, mime: 'image/png', id: await assetIdOf(SALT, hash) });
    expect(sent.at(-1)).not.toHaveProperty('png');
    expect(store.client.offers.flat()).toContainEqual({ id: await assetIdOf(SALT, hash), kind: 'image', size: mask.length });
    // A page that fetches it by hash from the GM still gets it.
    table.sent.length = 0;
    table.share.receive('p1', { t: 'asset-request', hash });
    await table.settle();
    expect(table.sent.some(({ body, to }) => body.t === 'asset-chunk' && body.hash === hash && to === 'p1')).toBe(true);
  });
});
