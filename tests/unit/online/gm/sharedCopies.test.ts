// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPanel, panelView, type PanelActions } from '../../../../src/app/online/gm/dock/OnlinePanel.ts';
import type { OnlineSnapshot, SceneFacts } from '../../../../src/app/online/gm/dock/panelModel.ts';
import { SharedCopies, sharedText } from '../../../../src/app/online/gm/assets/sharedCopies.ts';
import type { StoreResult, StoreTrouble } from '../../../../src/app/online/gm/assets/storeClient.ts';
import type { StoreUsage } from '../../../../src/app/online/gm/assets/assetRoutes.ts';

const GIB = 1024 ** 3;
const DAY = 24 * 60 * 60 * 1000;
const SCENE: SceneFacts = { isShared: true, tokens: {}, selected: [] };
const feedback = { open: false, diagnostics: false, state: 'idle', errorReports: false } as const;
const snapshot: OnlineSnapshot = { status: 'online', link: 'https://play.atlas-vtt.dev/#code', campaignId: null, sharedLeaf: null, sharedName: null, sharedTokens: {}, players: [], playerTokens: [], seats: null, gate: null, rests: [], cardOrder: [] };

beforeEach(() => {
  (globalThis as { CSS?: unknown }).CSS ??= { escape: (value: string) => value };
  document.body.empty();
});

describe('the line of the shared copies', () => {
  it('says what they hold of the quota and when the oldest leaves', () => {
    const usage = { bytes: 3.2 * GIB, quota: 20 * GIB, oldestLeavesAt: 12.5 * DAY };
    expect(sharedText(usage, 0)).toBe('Shared with players: 3.2 GB of 20 GB, oldest leaves in 12 days');
    expect(sharedText({ ...usage, oldestLeavesAt: 1.5 * DAY }, 0)).toBe('Shared with players: 3.2 GB of 20 GB, oldest leaves in 1 day');
    expect(sharedText({ ...usage, oldestLeavesAt: DAY / 2 }, 0)).toBe('Shared with players: 3.2 GB of 20 GB, oldest leaves today');
    expect(sharedText({ bytes: 0, quota: 10 * GIB, oldestLeavesAt: null }, 0)).toBe('Shared with players: 0 kB of 10 GB');
    expect(sharedText('unknown', 0)).toBe('Shared copies for players cannot be checked right now');
    expect(sharedText(null, 0)).toBeNull();
  });

  it('stands in the table panel, and removing the copies asks first', () => {
    const layer = document.body.createDiv();
    const removeShared = vi.fn();
    const does = { removeShared, selected: () => [], imageSrc: (path: string) => path } as unknown as PanelActions;
    renderPanel(layer, panelView(snapshot, SCENE, feedback, false, 'Online table', 'Shared with players: 1 GB of 20 GB'), does);
    expect(layer.querySelector('.atlas-online-shared__text')?.textContent).toBe('Shared with players: 1 GB of 20 GB');
    const button = [...layer.querySelectorAll('button')].find((candidate) => candidate.textContent === 'Remove shared copies now');
    expect(button?.classList.contains('atlas-online-button--ghost')).toBe(true);
    button?.click();
    expect(removeShared).not.toHaveBeenCalled();
    expect(layer.querySelector('.atlas-online-confirm__text')?.textContent).toMatch(/Remove every copy kept for your players/);
    [...layer.querySelectorAll('button')].find((candidate) => candidate.textContent === 'Remove')?.click();
    expect(removeShared).toHaveBeenCalledOnce();
    expect(layer.querySelector('[title]')).toBeNull();
  });

  it('is left out while nothing can be told', () => {
    const layer = document.body.createDiv();
    renderPanel(layer, panelView(snapshot, SCENE, feedback), { selected: () => [] } as unknown as PanelActions);
    expect(layer.querySelector('.atlas-online-shared')).toBeNull();
  });
});

describe('the shared copies', () => {
  function copies(usage: () => StoreResult<StoreUsage>, removal: StoreResult<null> = { ok: true, value: null }): { copies: SharedCopies; asked: { usage: number; removed: number; emptied: number; signedOut: number }; notices: string[]; clock: { now: number } } {
    const asked = { usage: 0, removed: 0, emptied: 0, signedOut: 0 };
    const notices: string[] = [];
    const clock = { now: 0 };
    const made = new SharedCopies({
      client: { usage: () => (asked.usage += 1, Promise.resolve(usage())), deleteAll: () => (asked.removed += 1, Promise.resolve(removal)) },
      signedIn: () => true,
      signedOutByServer: () => void (asked.signedOut += 1),
      emptied: () => void (asked.emptied += 1),
      notify: (text) => notices.push(text),
      now: () => clock.now,
    });
    return { copies: made, asked, notices, clock };
  }
  const usage = { bytes: GIB, quota: 20 * GIB, oldestLeavesAt: null };

  it('are asked for when the panel opens, not again moments later', async () => {
    const made = copies(() => ({ ok: true, value: usage }));
    await made.copies.refresh();
    await made.copies.refresh();
    expect(made.asked.usage).toBe(1);
    expect(made.copies.current()).toEqual(usage);
    made.clock.now = 60_000;
    await made.copies.refresh();
    expect(made.asked.usage).toBe(2);
    await made.copies.refresh(true);
    expect(made.asked.usage).toBe(3);
  });

  it('say nothing where the relay keeps none, and that they cannot be told where it fails', async () => {
    const trouble = (kind: StoreTrouble): StoreResult<StoreUsage> => ({ ok: false, trouble: kind });
    const missing = copies(() => trouble('missing'));
    await missing.copies.refresh();
    expect(missing.copies.current()).toBeNull();
    const failing = copies(() => trouble('retry'));
    await failing.copies.refresh();
    expect(failing.copies.current()).toBe('unknown');
  });

  it('are removed all at once: the table shares again what players see, and the GM is told', async () => {
    const made = copies(() => ({ ok: true, value: usage }));
    expect(await made.copies.removeAll()).toBe(true);
    expect(made.asked).toMatchObject({ removed: 1, emptied: 1, usage: 1 });
    expect(made.notices).toEqual(['Shared copies removed.']);
    const quiet = copies(() => ({ ok: true, value: usage }));
    await quiet.copies.removeAll(true);
    expect(quiet.notices).toEqual([]);
    const failed = copies(() => ({ ok: true, value: usage }), { ok: false, trouble: 'retry' });
    expect(await failed.copies.removeAll()).toBe(false);
    expect(failed.asked.emptied).toBe(0);
    expect(failed.notices).toEqual(['Shared copies could not be removed. Try again later.']);
  });
});
