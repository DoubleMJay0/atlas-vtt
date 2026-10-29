import { EXPLORED_INLINE_BYTES, parseGmMessage, type GmMessage } from '../../../../src/app/online/protocol/index.ts';
import { describe, expect, it } from 'vitest';
import { EXPLORED_INTERVAL_MS } from '../../../../src/app/online/gm/InputShare.ts';
import { toBase64 } from '../../../../src/app/online/gm/assetServe.ts';
import { bytesOf, publisherHarness } from './fakeAssetStore.ts';
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
  it('goes inline as a PNG, and is never offered to the store', async () => {
    const mask = bytesOf(5000, 3);
    const { sent, store } = await exploredSent(mask);
    expect(sent.at(-1)).toEqual({ t: 'explored', scene: '000000000000000000000001', png: toBase64(mask) });
    // Players read it as the protocol has it.
    expect(parseGmMessage(JSON.parse(JSON.stringify(sent.at(-1))))).toEqual(sent.at(-1));
    expect(store.client.offers.flat().some((asset) => asset.size === mask.length)).toBe(false);
  });

  it('goes as none where it is larger than goes inline, and is not offered either', async () => {
    const mask = bytesOf(EXPLORED_INLINE_BYTES + 1, 4);
    const { sent, store } = await exploredSent(mask);
    expect(sent.at(-1)).toEqual({ t: 'explored', scene: '000000000000000000000001' });
    expect(store.client.offers.flat().some((asset) => asset.size === mask.length)).toBe(false);
  });
});
