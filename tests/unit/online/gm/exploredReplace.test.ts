import type { GmMessage } from '../../../../src/app/online/protocol/index.ts';
import { parseGmMessage } from '../../../../src/app/online/protocol/index.ts';
import type { SceneState } from '../../../../src/app/online/gm/atlasView.ts';
import type { SceneLevel } from '../../../../src/app/types/sceneLevelTypes';
import { describe, expect, it } from 'vitest';
import { EXPLORED_INTERVAL_MS } from '../../../../src/app/online/gm/InputShare.ts';
import { sceneState, shareHarness, type ShareHarness } from './shareHarness.ts';

type Explored = Extract<GmMessage, { t: 'explored' }>;

const mask = (name: string): string => `data:image/png;base64,${btoa(name)}`;
const LIT = { lighting: { enabled: true, ambient: 0.2 } };
const MAP = new Map([['maps/cave.webp', new Uint8Array(64)], ['maps/upper.webp', new Uint8Array(32)]]);

/** The explored messages players got, whether each replaces their memory. */
const replaces = (table: ShareHarness): boolean[] => table.sent.flatMap(({ body }) => (body.t === 'explored' ? [(body as Explored).replace === true] : []));

async function shared(state: SceneState): Promise<ShareHarness> {
  const table = shareHarness(state, MAP);
  table.share.start();
  await table.set(state);
  await table.advance(EXPLORED_INTERVAL_MS + 100);
  return table;
}

/** The GM's next state, sent and given time to reach players. */
async function then(table: ShareHarness, changes: Partial<SceneState>): Promise<void> {
  await table.set({ ...table.state(), ...changes });
  await table.advance(EXPLORED_INTERVAL_MS + 100);
}

describe('an explored memory the GM saves', () => {
  it('is added to the players\' memory while sight alone made it, so a save older than what they saw takes nothing away', async () => {
    const table = await shared(sceneState({ ...LIT, exploredMask: mask('first') }));
    await then(table, { exploredMask: mask('more') });
    expect(replaces(table)).toEqual([false, false]);
  });

  it('replaces theirs once it holds memory the GM took away by hand, and only that save', async () => {
    const table = await shared(sceneState({ ...LIT, exploredMask: mask('first') }));
    // Forget: the edit is counted at once, the memory saved after it.
    await table.set({ ...table.state(), exploredEdits: 1 });
    await then(table, { exploredMask: mask('forgotten') });
    await then(table, { exploredMask: mask('seen since') });
    // Undo of it is an edit too.
    await table.set({ ...table.state(), exploredEdits: 0 });
    await then(table, { exploredMask: mask('back') });
    expect(replaces(table)).toEqual([false, true, false, true]);
    const sent = table.sent.flatMap(({ body }) => (body.t === 'explored' ? [body] : []));
    expect(parseGmMessage(JSON.parse(JSON.stringify(sent[1])))).toEqual(sent[1]);
  });

  it('replaces theirs where the memory went as none after it was some', async () => {
    const table = await shared(sceneState({ ...LIT, exploredMask: mask('first') }));
    await then(table, { exploredMask: null });
    expect(replaces(table)).toEqual([false, true]);
  });

  it('is not made a replacement by an edit of a floor the players are not on', async () => {
    const levels: SceneLevel[] = [
      { id: 'ground', name: 'Ground', elevation: { bottom: 0, top: 10 }, background: 'maps/cave.webp' },
      { id: 'upper', name: 'Upper', elevation: { bottom: 10, top: 20 }, background: 'maps/upper.webp' },
    ];
    const table = shareHarness(sceneState({ ...LIT, levels, viewedLevel: 'ground', exploredMask: mask('ground') }), MAP);
    table.presented = 'ground';
    table.share.start();
    await table.set(table.state());
    await table.advance(EXPLORED_INTERVAL_MS + 100);
    // The GM edits the floor above, then comes back and the ground's memory is saved.
    await table.set({ ...table.state(), viewedLevel: 'upper' });
    await then(table, { exploredEdits: 1, exploredMasks: { upper: mask('upper forgotten') } });
    await table.set({ ...table.state(), viewedLevel: 'ground' });
    await then(table, { exploredMask: mask('ground seen') });
    expect(replaces(table)).toEqual([false, false]);
  });
});
