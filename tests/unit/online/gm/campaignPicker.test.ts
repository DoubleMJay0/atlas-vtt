import { describe, expect, it, vi } from 'vitest';
import type { CampaignChoice } from '../../../../src/app/online/gm/campaignChoices.ts';
import { campaignPick, renderCampaignPicker, type CampaignPickerActions } from '../../../../src/app/online/gm/dock/campaignPicker.ts';
import { tableTitle, type OnlineSnapshot } from '../../../../src/app/online/gm/dock/panelModel.ts';

const choice = (id: string, over: Partial<CampaignChoice> = {}): CampaignChoice => ({ id, name: id.toUpperCase(), activity: 'Played 3d ago', players: 0, art: null, hue: 120, playing: false, ...over });
const STRAHD = choice('strahd', { name: 'Curse of Strahd', players: 4 });
const CAVES = choice('caves', { name: 'Blue Mouth Caves', players: 1, playing: true });
const LIST = [STRAHD, CAVES];

function actions(): CampaignPickerActions & { [K in keyof CampaignPickerActions]: ReturnType<typeof vi.fn> } {
  return { choose: vi.fn(), start: vi.fn(), openCampaigns: vi.fn() };
}

function picker(list: readonly CampaignChoice[] | null, picked: string | null = null): { layer: HTMLElement; rows: HTMLButtonElement[]; does: ReturnType<typeof actions> } {
  const layer = document.body.createDiv();
  const does = actions();
  renderCampaignPicker(layer, campaignPick(list, picked), does);
  return { layer, rows: [...layer.querySelectorAll<HTMLButtonElement>('[role="radio"]')], does };
}

describe('the campaign a table starts on', () => {
  it('is the one the GM picked while it is there, else the played one, else the one played last', () => {
    expect(campaignPick(LIST, 'strahd').chosen).toBe('strahd');
    expect(campaignPick(LIST, 'gone').chosen).toBe('caves');
    expect(campaignPick(LIST, null).chosen).toBe('caves');
    expect(campaignPick([STRAHD, choice('other')], null).chosen).toBe('strahd');
    expect(campaignPick([], null).chosen).toBeNull();
    expect(campaignPick(null, 'strahd').chosen).toBeNull();
  });

  it('shows each campaign with its name, when it was played and its players, the chosen one checked', () => {
    const { rows } = picker(LIST);
    expect(rows.map((row) => row.querySelector('.atlas-online-campaign__name bdi')?.textContent)).toEqual(['Curse of Strahd', 'Blue Mouth Caves']);
    expect(rows.map((row) => row.querySelector('.atlas-online-campaign__meta')?.textContent)).toEqual(['Played 3d ago · 4 players', 'Played 3d ago · 1 player']);
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    // One tab stop, as a radio group has.
    expect(rows.map((row) => row.tabIndex)).toEqual([-1, 0]);
    expect(rows[1]?.querySelector('.atlas-online-campaign__playing')?.textContent).toBe('Playing');
  });

  it('shows the world map, or the campaign\'s own tint where it has none', () => {
    const { rows } = picker([choice('a', { art: 'app://map.webp' }), choice('b')]);
    expect(rows[0]?.querySelector('img')?.getAttribute('src')).toBe('app://map.webp');
    expect(rows[1]?.querySelector('img')).toBeNull();
    expect(rows[1]?.querySelector('.campaign-emblem')).not.toBeNull();
  });

  it('is chosen by a click or the arrow keys, and Enter or a double click starts the table', () => {
    const { rows, does } = picker(LIST);
    rows[0]?.click();
    expect(does.choose).toHaveBeenLastCalledWith('strahd');
    rows[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(does.choose).toHaveBeenLastCalledWith('strahd');
    // The redrawn menu gives focus to the campaign chosen now.
    expect(rows[1]?.dataset.focusKey).toBe('campaign-strahd');
    rows[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(does.choose).toHaveBeenLastCalledWith('caves');
    rows[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    rows[0]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(does.start).toHaveBeenCalledTimes(2);
  });

  it('offers the dashboard to a vault without campaigns, and waits for them while they are read', () => {
    const empty = picker([]);
    expect(empty.rows).toHaveLength(0);
    empty.layer.querySelector<HTMLButtonElement>('.atlas-online-button')?.click();
    expect(empty.does.openCampaigns).toHaveBeenCalledTimes(1);
    expect(picker(null).layer.textContent).toContain('Reading your campaigns');
  });

  it('names a running table by its campaign', () => {
    const running = { campaignId: 'strahd' } as OnlineSnapshot;
    expect(tableTitle(running, campaignPick(LIST, null))).toBe('Curse of Strahd');
    expect(tableTitle({ campaignId: null } as OnlineSnapshot, campaignPick(LIST, null))).toBe('Online table');
  });
});
