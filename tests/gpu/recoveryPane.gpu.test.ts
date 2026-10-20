import '../setup/obsidianDom';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import css from '../../styles/main.scss?inline';
import { templateButtons } from '../../src/app/recovery/editor/recoveryEdits';
import { ADVENTURER } from '../fixtures/recoveryFixtures';
import { mountRecoveryDialog, RECOVERY_THEME } from './recoveryPaneHarness';

// Dice links reach the map view and the token link service, whose Node `events` has no browser build.
vi.mock('../../src/app/services/statblockDiceLinks', () => ({
  attachDiceRolling: () => () => undefined,
  diceLinkProps: () => ({}),
  linkDiceIn: () => undefined,
}));
vi.mock('../../src/app/statblocks/render/shared/useStatblockDiceRolling', () => ({ useStatblockDiceRolling: () => [undefined, null] }));

const OVERLAY_MARGIN = 32;
const rect = (selector: string): DOMRect => document.querySelector(selector)!.getBoundingClientRect();
const all = (selector: string): DOMRect[] => [...document.querySelectorAll(selector)].map((element) => element.getBoundingClientRect());
const frames = (count = 2): Promise<void> => new Promise((resolve) => {
  const step = (left: number): void => { if (left === 0) resolve(); else requestAnimationFrame(() => step(left - 1)); };
  step(count);
});
const spot = (name: RegExp) => page.getByRole('button', { name });
const press = async (keys: string): Promise<void> => {
  await userEvent.keyboard(keys);
  await frames();
};

describe('the recovery pane of the Resources tab', () => {
  const style = document.createElement('style');
  style.textContent = RECOVERY_THEME + css;

  beforeAll(() => { MotionGlobalConfig.skipAnimations = true; });
  afterAll(() => { MotionGlobalConfig.skipAnimations = false; });
  beforeEach(async () => {
    await page.viewport(1440, 900);
    document.head.append(style);
  });
  afterEach(() => {
    cleanup();
    style.remove();
  });

  it('fills the window but for the overlay\'s margin, the sockets beside the pane', async () => {
    mountRecoveryDialog('dark');
    await frames();
    const modal = rect('.atlas-collection-settings-modal');
    expect(modal.left).toBeCloseTo(OVERLAY_MARGIN, 0);
    expect(modal.top).toBeCloseTo(OVERLAY_MARGIN, 0);
    expect(window.innerWidth - modal.right).toBeCloseTo(OVERLAY_MARGIN, 0);
    expect(window.innerHeight - modal.bottom).toBeCloseTo(OVERLAY_MARGIN, 0);

    const sockets = rect('.atlas-csm-resources-layout__sockets');
    const pane = rect('.atlas-rc-pane');
    expect(sockets.right).toBeLessThan(pane.left);
    expect(pane.right).toBeLessThanOrEqual(rect('.atlas-collection-settings-content').right);
  });

  it('stacks the template tabs, the rail and the card, one left edge, capsules one height', async () => {
    mountRecoveryDialog('light');
    await frames();
    const strip = rect('.atlas-rc-templates');
    const rail = rect('.atlas-rc-rail');
    const stage = rect('.atlas-rc-stage');
    expect(strip.bottom).toBeLessThanOrEqual(rail.top);
    expect(rail.bottom).toBeLessThan(stage.top);
    expect(rail.left).toBeCloseTo(strip.left, 0);
    expect(stage.left).toBeCloseTo(strip.left, 0);
    const capsules = all('.atlas-rc-capsule, .atlas-rc-rail__add');
    expect(capsules).toHaveLength(3);
    for (const capsule of capsules) expect(capsule.height).toBeCloseTo(30, 0);
    expect(new Set(capsules.map((capsule) => Math.round(capsule.top))).size).toBe(1);
  });

  it('opens a fan of eight over a picked metric and the card under it, inside the stage, nothing over its fields', async () => {
    mountRecoveryDialog('dark');
    await userEvent.click(page.getByRole('button', { name: /^Long rest/ }));
    await userEvent.click(spot(/^Hit Dice:/));
    await frames();
    const stage = rect('.atlas-rc-stage');
    const metric = rect('.atlas-rc-spot.atlas-picked');
    const items = all('.atlas-rc-fan .atlas-csm-fan__item');
    expect(items).toHaveLength(8);
    for (const item of items) {
      expect(item.left).toBeGreaterThanOrEqual(stage.left);
      expect(item.right).toBeLessThanOrEqual(stage.right);
      expect(item.bottom).toBeLessThanOrEqual(metric.top);
    }
    for (let i = 1; i < items.length; i++) {
      const [a, b] = [items[i - 1]!, items[i]!];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.width);
    }
    // The kinds a counters metric does not take stay in place, inert
    expect(page.getByRole('button', { name: 'Only for conditions' }).elements()).toHaveLength(2);

    const card = rect('.atlas-rc-card');
    expect(card.top).toBeGreaterThanOrEqual(metric.bottom);
    expect(card.left).toBeGreaterThanOrEqual(stage.left);
    expect(card.right).toBeLessThanOrEqual(stage.right);
    const input = page.getByRole('textbox', { name: 'At least' }).element();
    const box = input.getBoundingClientRect();
    expect(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)).toBe(input);
  });

  it('takes Escape back step by step: the fan, the card, the metric, then the dialog', async () => {
    const onClose = vi.fn();
    mountRecoveryDialog('dark', undefined, onClose);
    await userEvent.click(page.getByRole('button', { name: /^Long rest/ }));
    await userEvent.click(spot(/^Hit Dice:/));
    await frames();
    expect(document.querySelector('.atlas-rc-fan')).not.toBeNull();
    expect(document.querySelector('.atlas-rc-card')).not.toBeNull();

    await press('{Escape}');
    expect(document.querySelector('.atlas-rc-fan')).toBeNull();
    expect(document.querySelector('.atlas-rc-card')).not.toBeNull();
    await press('{Escape}');
    expect(document.querySelector('.atlas-rc-card')).toBeNull();
    expect(document.querySelector('.atlas-rc-spot.atlas-picked')).not.toBeNull();
    await press('{Escape}');
    expect(document.querySelector('.atlas-rc-spot.atlas-picked')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    await press('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sets up a Long rest from the keyboard alone', async () => {
    const harness = mountRecoveryDialog('dark', {});
    await frames();
    page.getByRole('tab', { name: 'Player character' }).element().focus();

    await press('{Tab}{Enter}');
    expect(document.activeElement).toBe(page.getByRole('textbox', { name: 'Button name' }).element());
    await press('Long rest{Enter}');
    expect(document.activeElement?.textContent).toBe('Long rest');

    // Past Add to the card: hit points back to full, the rule a metric starts with
    await press('{Tab}{Tab}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('HP: not given back');
    await press('{Enter}');
    expect(document.activeElement?.closest('.atlas-rc-fan')).not.toBeNull();
    await press('{Escape}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('HP: Full');

    // Stress set to 0
    await press('{ArrowDown}{Enter}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}');
    expect(document.activeElement).toBe(page.getByRole('textbox', { name: 'Set to' }).element());
    await press('{Escape}{Escape}');

    // Half the Hit Dice
    await press('{ArrowDown}{Enter}{ArrowRight}{ArrowRight}{Enter}{Escape}{Escape}');

    // Features back to full, and Exhaustion one step down
    await press('{ArrowDown}{Enter}{Escape}{ArrowDown}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Exhaustion: not given back');
    await press('{Enter}{Escape}');

    const [long] = templateButtons(harness.record(), ADVENTURER.id);
    expect(long!.name).toBe('Long rest');
    expect(long!.rules).toEqual([
      { target: { kind: 'resource', key: 'hp' }, does: 'full' },
      { target: { kind: 'resource', key: 'stress' }, does: 'set', to: 0 },
      { target: { kind: 'counters', field: 'hit_dice', rows: 'all' }, does: 'share', share: 0.5, round: 'down' },
      { target: { kind: 'counters', field: 'features', rows: 'all' }, does: 'full' },
      { target: { kind: 'condition', id: 'exhaustion' }, does: 'step', by: -1 },
    ]);
  });

  it('renames a button in place, and Delete removes it, focus going to the next', async () => {
    const harness = mountRecoveryDialog('dark');
    await userEvent.dblClick(page.getByRole('button', { name: /^Short rest/ }));
    await press('Catch breath{Enter}');
    expect(templateButtons(harness.record(), ADVENTURER.id)[0]!.name).toBe('Catch breath');
    expect(document.activeElement?.textContent).toContain('Catch breath');
    await press('{Delete}');
    expect(templateButtons(harness.record(), ADVENTURER.id).map((button) => button.name)).toEqual(['Long rest']);
    expect(document.activeElement?.textContent).toContain('Long rest');
    // The removed button's id is gone from every counters rule
    expect(JSON.stringify(harness.record())).not.toContain('rest-short1');
  });

  it('moves a button with Alt and an arrow', async () => {
    const harness = mountRecoveryDialog('dark');
    page.getByRole('button', { name: /^Long rest/ }).element().focus();
    await press('{Alt>}{ArrowLeft}{/Alt}');
    expect(templateButtons(harness.record(), ADVENTURER.id).map((button) => button.name)).toEqual(['Long rest', 'Short rest']);
    expect(document.activeElement?.textContent).toContain('Long rest');
  });

  it('picks what a Spend rule spends with the next metric', async () => {
    const harness = mountRecoveryDialog('dark');
    await userEvent.click(page.getByRole('button', { name: /^Long rest/ }));
    await userEvent.click(spot(/^Stress: →/));
    await userEvent.click(page.getByRole('button', { name: 'Back by spending another' }));
    expect(document.querySelector('.atlas-rc-prompt')?.textContent).toContain('Pick what is spent');
    expect(document.querySelector('.atlas-rc-card')).toBeNull();
    expect(document.querySelectorAll('.atlas-rc-spot.atlas-source').length).toBeGreaterThan(0);
    await userEvent.click(spot(/^Hit Dice:/));
    const rule = templateButtons(harness.record(), ADVENTURER.id)[1]!.rules.find((each) => each.target.kind === 'resource' && each.target.key === 'stress');
    expect(rule).toEqual({ target: { kind: 'resource', key: 'stress' }, does: 'spend', from: { kind: 'counters', field: 'hit_dice', rows: 'all' }, each: '1' });
    expect(page.getByRole('textbox', { name: 'Each one gives back' }).element()).toBeTruthy();
  });

  it('says why a number that is no token resource cannot be picked', async () => {
    mountRecoveryDialog('dark');
    await userEvent.hover(document.querySelector<HTMLElement>('[data-block-id="statac01"] .atlas-rc-spot--refused')!);
    await expect.poll(() => document.querySelector('[role="tooltip"]')?.textContent).toContain('Not a token resource');
  });
});
