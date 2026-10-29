import { describe, expect, it } from 'vitest';
import type { BookQuest } from '../../../../src/app/online/protocol/index.ts';
import { ASSET_USES } from '../../../../src/app/online/gm/assets/assetUses.ts';
import { RestingLatency, Slots } from '../../../../src/app/online/gm/assets/uploadPace.ts';
import { SharedCopies } from '../../../../src/app/online/gm/assets/sharedCopies.ts';
import { StoredQuests } from '../../../../src/app/online/gm/book/storedQuests.ts';
import { sha256Hex } from '../../../../src/app/online/gm/assetServe.ts';
import { bytesOf, publisherHarness } from './fakeAssetStore.ts';

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
    const shared = await store.publisher.storing.refOf(bytesOf(100, 1), 'image/webp', ASSET_USES.map);
    const anasText = await store.publisher.storing.refOf(bytesOf(100, 2), 'text/markdown', ASSET_USES.text);
    // Drawn for Bo's sheet but never sent to anyone.
    const unsent = await store.publisher.storing.refOf(bytesOf(100, 3), 'text/markdown', ASSET_USES.text);
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
    // Handed a stored asset, she hears its share at once; a resend names it again, to her alone.
    store.publisher.resend('cleo');
    expect(store.sent.map(({ body, to }) => [to, Object.keys(body.t === 'asset-progress' ? body.shares : {})])).toEqual([['cleo', [shared.id]], ['cleo', [shared.id]]]);
  });

  it('tells everyone at once what everyone was sent', async () => {
    const store = publisherHarness();
    store.players = ['ana', 'bo'];
    const shared = await store.publisher.storing.refOf(bytesOf(100, 1), 'image/webp', ASSET_USES.map);
    store.hand(shared);
    // The hand-over itself tells each player at once; what moves after that goes to everyone in one message.
    store.sent.length = 0;
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
    const art = await store.publisher.storing.refOf(bytesOf(60, 5), 'image/png', ASSET_USES.art);
    await store.advance(200);
    store.client.release(1);
    await store.idle();
    const after = store.client.calls.filter((call) => call.kind !== 'start');
    expect(after.map((call) => call.id).slice(0, 2)).toEqual([video?.id, art.id]);
  });

  it('hands every asset players were sent again without its id once nothing goes up any more, and finishes what the store took when it is only full', async () => {
    const signedOut = publisherHarness();
    signedOut.client.hold = true;
    signedOut.connection = { players: 1, latencyMs: 40 };
    const first = await signedOut.publisher.storing.refOf(bytesOf(100, 1), 'image/png', ASSET_USES.art);
    const second = await signedOut.publisher.storing.refOf(bytesOf(100, 2), 'image/png', ASSET_USES.art);
    signedOut.connection = { players: 1, latencyMs: 200 };
    signedOut.client.result = () => ({ ok: false, trouble: 'forbidden' });
    await signedOut.advance(200);
    signedOut.client.release();
    await signedOut.idle();
    expect(signedOut.withdrawn).toBeGreaterThan(0);
    // Neither is handed with its id again.
    expect((await signedOut.publisher.storing.refOf(bytesOf(100, 1), 'image/png', ASSET_USES.art)).id).toBeUndefined();
    expect((await signedOut.publisher.storing.refOf(bytesOf(100, 2), 'image/png', ASSET_USES.art)).id).toBeUndefined();
    expect([first.id, second.id].every((id) => id !== undefined)).toBe(true);

    const full = publisherHarness();
    const accepted = await full.publisher.storing.refOf(bytesOf(100, 3), 'image/png', ASSET_USES.art);
    await full.publisher.storing.refOf(bytesOf(100, 4), 'image/png', ASSET_USES.art);
    full.client.answer = (asset) => (asset.id === accepted.id ? { answer: 'need', upload: 'single', partBytes: 95 * MIB } : { answer: 'refused', reason: 'quota' });
    await full.advance(2000);
    expect(full.client.calls.map((call) => call.id)).toEqual([accepted.id]);
  });
});

describe('the store emptied, and superseded memories', () => {
  it('uploads a large kept asset again once the shared copies were removed, its bytes given back by the next hand-out', async () => {
    const store = publisherHarness();
    const handout = bytesOf(2 * MIB, 6);
    const ref = await store.publisher.storing.refOf(handout, 'image/png', ASSET_USES.image);
    await store.advance(1000);
    expect(store.client.calls).toHaveLength(1);
    store.publisher.emptied();
    expect(store.withdrawn).toBe(1);
    expect((await store.publisher.storing.refOf(handout, 'image/png', ASSET_USES.image)).id).toBe(ref.id);
    await store.advance(1000);
    expect(store.client.calls.map((call) => call.id)).toEqual([ref.id, ref.id]);
  });

  it('neither uploads nor names an explored memory a newer one replaced before it went', async () => {
    const store = publisherHarness();
    const first = await store.publisher.storing.refOf(bytesOf(300_000, 7), 'image/png', ASSET_USES.explored);
    store.hand(first);
    store.publisher.storing.release(first);
    const second = await store.publisher.storing.refOf(bytesOf(300_000, 8), 'image/png', ASSET_USES.explored);
    store.hand(second);
    await store.advance(2000);
    expect(store.client.offers.flat().map((asset) => asset.id)).toEqual([second.id]);
    store.sent.length = 0;
    store.publisher.resend('p1');
    expect(store.sent.flatMap(({ body }) => Object.keys(body.t === 'asset-progress' ? body.shares : {}))).toEqual([second.id]);
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
    // A turn given back is given out once its holder could ask again: a task later at the latest.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(granted).toEqual([]);
    releases[1]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
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

describe('quests when the store refused their ids', () => {
  it('are made again once forgotten, without the ids the store will not keep', async () => {
    const text = new TextEncoder().encode('# Long text').slice();
    const hash = await sha256Hex(text);
    let id: string | undefined = 'a'.repeat(64);
    const quests = new StoredQuests({
      refOf: (bytes, mime) => Promise.resolve({ hash, size: bytes.length, mime, ...(id === undefined ? {} : { id }) }),
      fileRef: () => Promise.resolve(null),
      mapRef: () => Promise.reject(new Error('not used')),
      release: () => undefined,
    }, () => ({ bytes: text }));
    const quest = { id: 'q1', kind: 'main', state: 'open', title: 'Q', body: '…', text: { hash, size: text.length, mime: 'text/markdown' }, place: null, xp: 0, rewards: [] } as unknown as BookQuest;
    expect((await quests.of([quest]))[0]?.text?.id).toBe(id);
    id = undefined;
    expect((await quests.of([quest]))[0]?.text?.id).toBe('a'.repeat(64));
    quests.clear();
    expect((await quests.of([quest]))[0]?.text).not.toHaveProperty('id');
  });
});

describe('deleting the shared copies on sign-out', () => {
  it('stops the table\'s uploads first, and shares nothing again after the copies went', async () => {
    const store = publisherHarness();
    store.client.hold = true;
    await store.publisher.storing.refOf(bytesOf(100, 1), 'image/png', ASSET_USES.art);
    await store.advance(200);
    const order: string[] = [];
    const copies = new SharedCopies({
      client: { usage: () => (order.push('usage'), Promise.resolve({ ok: true, value: { bytes: 0, quota: 1, oldestLeavesAt: null } })), deleteAll: () => (order.push('delete'), Promise.resolve({ ok: true, value: null })) },
      signedIn: () => true,
      signedOutByServer: () => undefined,
      emptied: () => (order.push('emptied'), store.publisher.emptied()),
      notify: () => order.push('notice'),
      now: () => 0,
    });
    // As the account's sign-out runs it: the table first, then the copies.
    store.publisher.suspend();
    await copies.removeAll(true);
    expect(order).toEqual(['delete']);
    store.client.release();
    await store.advance(5000);
    expect(store.client.offers).toHaveLength(1);
    expect(store.client.calls).toHaveLength(1);
  });
});

