import { describe, expect, it } from 'vitest';
import { ASSET_USES } from '../../../../src/app/online/gm/assets/assetUses.ts';
import { RestingLatency, Slots } from '../../../../src/app/online/gm/assets/uploadPace.ts';
import { SharedCopies } from '../../../../src/app/online/gm/assets/sharedCopies.ts';
import type { HandedQuest } from '../../../../src/app/online/gm/book/questGate.ts';
import { StoredQuests } from '../../../../src/app/online/gm/book/storedQuests.ts';
import { sha256Hex } from '../../../../src/app/online/gm/assetServe.ts';
import { bytesOf, publisherHarness } from './fakeAssetStore.ts';
import { kept } from './fakeStoring.ts';

const MIB = 1024 * 1024;

/** The ids each recipient heard of in progress messages. */
function heardBy(sent: ReturnType<typeof publisherHarness>['sent']): Map<string, Set<string>> {
  const heard = new Map<string, Set<string>>();
  for (const { body, to } of sent) {
    if (body.t !== 'asset-progress') continue;
    const ids = heard.get(to ?? '*') ?? new Set<string>();
    for (const id of Object.keys(body.shares)) ids.add(id);
    heard.set(to ?? '*', ids);
  }
  return heard;
}

describe('what players hear of the uploads', () => {
  it('names to each player only the ids they were sent, and nothing to a player who joins but what they were sent', async () => {
    const store = publisherHarness();
    store.players = ['ana', 'bo'];
    const shared = kept(await store.publisher.storing.refOf(bytesOf(100, 1), 'image/webp', ASSET_USES.map));
    const anasText = kept(await store.publisher.storing.refOf(bytesOf(100, 2), 'text/markdown', ASSET_USES.text));
    // Drawn for Bo's sheet but never sent to anyone.
    const unsent = kept(await store.publisher.storing.refOf(bytesOf(100, 3), 'text/markdown', ASSET_USES.text));
    store.hand(shared);
    store.hand(anasText, 'ana');
    await store.advance(2000);
    const heard = heardBy(store.sent);
    expect([...(heard.get('ana') ?? [])].sort()).toEqual([shared.id, anasText.id].sort());
    expect([...(heard.get('bo') ?? [])]).toEqual([shared.id]);
    expect(heard.has('*')).toBe(false);
    expect([...heard.values()].some((ids) => ids.has(unsent.id ?? ''))).toBe(false);
    // Cleo joins: before she is sent anything she hears of nothing; then of what she was sent alone.
    store.players = ['ana', 'bo', 'cleo'];
    store.sent.length = 0;
    store.publisher.resend('cleo');
    expect(store.sent).toEqual([]);
    store.hand(shared, 'cleo');
    store.publisher.resend('cleo');
    expect(store.sent.map(({ body, to }) => [to, Object.keys(body.t === 'asset-progress' ? body.shares : {})])).toEqual([['cleo', [shared.id]]]);
  });

  it('tells everyone at once what everyone was sent', async () => {
    const store = publisherHarness();
    store.players = ['ana', 'bo'];
    const shared = kept(await store.publisher.storing.refOf(bytesOf(100, 1), 'image/webp', ASSET_USES.map));
    store.hand(shared);
    await store.advance(2000);
    expect(new Set(store.sent.map(({ to }) => to))).toEqual(new Set(['*']));
  });
});

describe('stopping and halting', () => {
  it('sends no part once the table stopped', async () => {
    const store = publisherHarness();
    store.client.answer = () => ({ answer: 'need', upload: 'multipart', partBytes: 16 * MIB });
    store.client.hold = true;
    store.connection = { players: 1, latencyMs: 20 };
    store.files.set('maps/river.webm', bytesOf(48 * MIB, 4));
    await store.publisher.storing.fileRef('maps/river.webm', 'video/webm', ASSET_USES.video);
    await store.advance(200);
    const before = store.client.calls.length;
    store.publisher.stop();
    store.client.release();
    await store.idle();
    store.client.release();
    await store.idle();
    expect(store.client.calls.slice(before)).toEqual([]);
    expect(store.client.calls.filter((call) => call.kind === 'complete')).toEqual([]);
  });

  it('lets a later, more urgent asset overtake the parts of a video waiting for their turn', async () => {
    const store = publisherHarness();
    store.client.answer = (asset) => (asset.kind === 'video' ? { answer: 'need', upload: 'multipart', partBytes: 16 * MIB } : { answer: 'need', upload: 'single', partBytes: 95 * MIB });
    store.client.hold = true;
    // One request at a time.
    store.connection = { players: 1, latencyMs: 40 };
    store.files.set('maps/river.webm', bytesOf(48 * MIB, 4));
    const video = await store.publisher.storing.fileRef('maps/river.webm', 'video/webm', ASSET_USES.video);
    store.connection = { players: 1, latencyMs: 200 };
    await store.advance(200);
    expect(store.client.calls.filter((call) => call.kind === 'part')).toHaveLength(1);
    const art = kept(await store.publisher.storing.refOf(bytesOf(60, 5), 'image/png', ASSET_USES.art));
    await store.advance(200);
    store.client.release(1);
    await store.idle();
    const after = store.client.calls.filter((call) => call.kind !== 'start');
    expect(after.map((call) => call.id).slice(0, 2)).toEqual([video?.id, art.id]);
  });

  it('takes every asset players were sent away from them once nothing goes up any more, and finishes what the store took when it is only full', async () => {
    const signedOut = publisherHarness();
    signedOut.client.hold = true;
    signedOut.connection = { players: 1, latencyMs: 40 };
    kept(await signedOut.publisher.storing.refOf(bytesOf(100, 1), 'image/png', ASSET_USES.art));
    kept(await signedOut.publisher.storing.refOf(bytesOf(100, 2), 'image/png', ASSET_USES.art));
    signedOut.connection = { players: 1, latencyMs: 200 };
    signedOut.client.result = () => ({ ok: false, trouble: 'forbidden' });
    await signedOut.advance(200);
    signedOut.client.release();
    await signedOut.idle();
    expect(signedOut.withdrawn).toBeGreaterThan(0);
    // Neither is handed to players again.
    expect(await signedOut.publisher.storing.refOf(bytesOf(100, 1), 'image/png', ASSET_USES.art)).toBeNull();
    expect(await signedOut.publisher.storing.refOf(bytesOf(100, 2), 'image/png', ASSET_USES.art)).toBeNull();

    const full = publisherHarness();
    const accepted = kept(await full.publisher.storing.refOf(bytesOf(100, 3), 'image/png', ASSET_USES.art));
    await full.publisher.storing.refOf(bytesOf(100, 4), 'image/png', ASSET_USES.art);
    full.client.answer = (asset) => (asset.id === accepted.id ? { answer: 'need', upload: 'single', partBytes: 95 * MIB } : { answer: 'refused', reason: 'quota' });
    await full.advance(2000);
    expect(full.client.calls.map((call) => call.id)).toEqual([accepted.id]);
  });
});

describe('the store emptied', () => {
  it('uploads a large kept asset again once the shared copies were removed, its bytes given back by the next hand-out', async () => {
    const store = publisherHarness();
    const handout = bytesOf(2 * MIB, 6);
    const ref = kept(await store.publisher.storing.refOf(handout, 'image/png', ASSET_USES.image));
    await store.advance(1000);
    expect(store.client.calls).toHaveLength(1);
    store.publisher.emptied();
    expect(store.withdrawn).toBe(1);
    expect(kept(await store.publisher.storing.refOf(handout, 'image/png', ASSET_USES.image)).id).toBe(ref.id);
    await store.advance(1000);
    expect(store.client.calls.map((call) => call.id)).toEqual([ref.id, ref.id]);
  });
});

describe('the connection\'s pace', () => {
  it('lets no more requests out than a limit that dropped while they were in flight', async () => {
    let limit = 2;
    const slots = new Slots(() => limit);
    const granted: number[] = [];
    const releases = await Promise.all([slots.take(), slots.take()]);
    void slots.take().then(() => granted.push(3));
    limit = 1;
    releases[0]?.();
    await Promise.resolve();
    expect(granted).toEqual([]);
    releases[1]?.();
    await Promise.resolve();
    expect(granted).toEqual([3]);
  });

  it('learns the resting round trip anew after a reconnect', () => {
    const resting = new RestingLatency();
    resting.sample(40, 0);
    resting.sample(90, 1000);
    expect(resting.value()).toBe(40);
    // A new socket (the publisher's `welcome`): what the old one measured counts no more.
    resting.reset();
    resting.sample(90, 2000);
    expect(resting.value()).toBe(90);
  });
});

describe('quests when the store refused their texts', () => {
  it('keep their opening alone, and ask for the text again once forgotten', async () => {
    const text = new TextEncoder().encode('# Long text').slice();
    const hash = await sha256Hex(text);
    let refused = false;
    const quests = new StoredQuests({
      refOf: (bytes, mime) => Promise.resolve(refused ? null : { hash, size: bytes.length, mime, id: 'a'.repeat(64) }),
      fileRef: () => Promise.resolve(null),
      mapRef: () => Promise.reject(new Error('not used')),
    }, () => ({ bytes: text }));
    const quest: HandedQuest = { id: 'q1', kind: 'main', state: 'open', title: 'Q', body: '…', text: { hash, size: text.length, mime: 'text/markdown' }, place: null, xp: 0, rewards: [] } as unknown as HandedQuest;
    expect((await quests.of([quest]))[0]?.text?.id).toBe('a'.repeat(64));
    refused = true;
    // A quest made whole is kept as it was made.
    expect((await quests.of([quest]))[0]?.text?.id).toBe('a'.repeat(64));
    quests.clear();
    expect((await quests.of([quest]))[0]).not.toHaveProperty('text');
    refused = false;
    expect((await quests.of([quest]))[0]?.text?.id).toBe('a'.repeat(64));
  });
});
