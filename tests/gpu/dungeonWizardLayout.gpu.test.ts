import '../setup/obsidianDom';
import { createElement } from 'react';
import { act } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { App } from 'obsidian';
import css from '../../styles/main.scss?inline';
import { DUNGEON_STYLES } from '../../src/app/dungeons/styleCatalog';
import { DungeonWorkerClient } from '../../src/app/dungeons/worker/DungeonWorkerClient';
import { DungeonWizard, WIZARD_PANEL_WIDTH } from '../../src/app/packages/components/dungeon-generator/DungeonWizard';
import { WIZARD_GAP, WIZARD_MARGIN, type Box } from '../../src/app/packages/components/dungeon-generator/wizardLayout';

/**
 * The dungeon wizard over the Atlas view, laid out by the plugin's real stylesheet and drawn by the
 * real worker. The variables stand in for Obsidian's theme.
 */
const THEME = `
  body { margin: 0; font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; --background-primary: #1e1e1e; --background-secondary: #262626; --background-modifier-border: #363636;
    --divider-color: #363636; --text-normal: #dadada; --text-muted: #b3b3b3; --interactive-accent: #7f6df2; --mono-100: #ffffff; --radius-s: 4px; --radius-m: 8px; --radius-l: 12px; --radius-xl: 24px;
    --font-ui-smaller: 12px; --font-ui-small: 13px; --font-ui-large: 20px; --input-height: 30px; --line-height-tight: 1.3; }
  button, input { font: inherit; }
  button { height: 30px; }
  .view-content { padding: 16px; }
`;

const app = {} as App;
let root: Root | null = null;
let view: HTMLElement;
let tab: HTMLElement;
const style = document.createElement('style');
style.textContent = THEME + css;

/** The wizard over an Atlas view of `width` × `height` px (here the page, as a leaf contains it), in place of `anchor`. */
async function openWizard(width: number, height: number, anchor?: Box): Promise<void> {
  await page.viewport(width, height);
  // As the Atlas view's UI layer, which lets presses through to the map
  view = document.body.createDiv({ cls: 'atlas-vtt-plugin' });
  view.style.pointerEvents = 'none';
  tab = view.createDiv({ cls: 'atlas-dungeon-generator-overlay' });
  root = createRoot(tab);
  act(() => root!.render(createElement(DungeonWizard, { app, layer: tab, collectionId: 'Dungeons', initialName: 'Crypt', anchor, onCreated: () => {}, onClose: () => {} })));
  await expect.poll(() => tab.querySelector('.atlas-dungeon-wizard-preview')).not.toBeNull();
  // Measured once panel and card have grown into place
  const settled = (selector: string): boolean => ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(tab.querySelector(selector)!).transform);
  await expect.poll(() => settled('.atlas-dungeon-wizard') && settled('.atlas-dungeon-wizard-preview'), { timeout: 2000 }).toBe(true);
}

const box = (selector: string): DOMRect => tab.querySelector(selector)!.getBoundingClientRect();
const computed = (selector: string, property: 'borderTopWidth' | 'borderTopRightRadius'): number => parseFloat(getComputedStyle(tab.querySelector(selector)!)[property]);
const goTo = (step: string): void => act(() => tab.querySelector<HTMLButtonElement>(`.atlas-dungeon-wizard__mark[aria-label="${step}"]`)!.click());

/** Whether a press at the middle of `selector` reaches it. */
const takesPresses = (selector: string): boolean => {
  const target = tab.querySelector(selector)!;
  const rect = target.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
  return hit !== null && (hit === target || target.contains(hit));
};

describe('the dungeon wizard over the Atlas view', () => {
  beforeEach(() => {
    MotionGlobalConfig.skipAnimations = true;
    document.head.append(style);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    view.remove();
    style.remove();
    DungeonWorkerClient.release(app);
    MotionGlobalConfig.skipAnimations = false;
  });

  it('takes the pin dropdown’s place, the map floating beside it in a card of its own', async () => {
    await openWizard(1440, 860, { left: 300, top: 120, width: 320, height: 420 });
    const panel = box('.atlas-dungeon-wizard');
    const card = box('.atlas-dungeon-wizard-preview');
    expect([panel.left, panel.top, panel.width]).toEqual([300, 120, WIZARD_PANEL_WIDTH]);
    expect(card.left).toBe(panel.right + WIZARD_GAP);
    expect(card.top).toBe(panel.top);
    expect(card.right).toBeLessThanOrEqual(1440 - WIZARD_MARGIN);
    // The close button sits $close-button-gap inside the panel's border, at its top right corner
    const border = computed('.atlas-dungeon-wizard', 'borderTopWidth');
    expect(border).toBeGreaterThan(0);
    const close = box('.atlas-close-btn');
    expect(close.right).toBeCloseTo(panel.right - border - 8, 1);
    expect(close.top).toBeCloseTo(panel.top + border + 8, 1);
    // Panel and card take presses although the layer they lie in lets them through
    expect(takesPresses('.atlas-close-btn')).toBe(true);
    expect(takesPresses('.atlas-dungeon-wizard-preview__tools')).toBe(true);

    // The map is drawn as large as the card allows
    await expect.poll(() => tab.querySelector('canvas.atlas-dungeon-preview__canvas'), { timeout: 20_000 }).not.toBeNull();
    const room = box('.atlas-dungeon-preview');
    const inset = computed('.atlas-dungeon-wizard-preview', 'borderTopWidth') + 8;
    expect(room.left - card.left).toBeCloseTo(inset, 1);
    expect(card.right - room.right).toBeCloseTo(inset, 1);
    await expect.poll(() => {
      const canvas = box('canvas.atlas-dungeon-preview__canvas');
      return Math.max(canvas.width / room.width, canvas.height / room.height);
    }, { timeout: 20_000 }).toBeCloseTo(1, 1);
  });

  it('stands panel and card side by side in the middle of the view without a pin', async () => {
    await openWizard(1440, 860);
    const panel = box('.atlas-dungeon-wizard');
    const card = box('.atlas-dungeon-wizard-preview');
    expect(Math.abs(panel.left - (1440 - card.right))).toBeLessThanOrEqual(1);
    expect(card.top).toBe(panel.top);
    expect(Math.abs(card.top - (860 - card.bottom))).toBeLessThanOrEqual(1);
  });

  it('keeps New layout and Export in the card’s top right corner, concentric with it', async () => {
    await openWizard(1440, 860, { left: 300, top: 120, width: 320, height: 420 });
    const card = box('.atlas-dungeon-wizard-preview');
    const tools = box('.atlas-dungeon-wizard-preview__tools');
    const border = computed('.atlas-dungeon-wizard-preview', 'borderTopWidth');
    expect(tools.top - card.top).toBeCloseTo(border + 12, 1);
    expect(card.right - tools.right).toBeCloseTo(border + 12, 1);
    // outer = inner + inset, the inset measured from inside the card's border (which a 1x screen rounds to whole pixels)
    const concentric = computed('.atlas-dungeon-wizard-preview', 'borderTopRightRadius') - border - 12;
    expect(Math.abs(concentric - computed('.atlas-dungeon-wizard-preview__tools', 'borderTopRightRadius'))).toBeLessThanOrEqual(0.5);
  });

  it('grows the panel to each step, the style gallery four cards a row, never past the view', async () => {
    await openWizard(1440, 700, { left: 300, top: 60, width: 320, height: 420 });
    const themeHeight = box('.atlas-dungeon-wizard').height;
    goTo('Style');
    await expect.poll(() => box('.atlas-dungeon-wizard').height, { timeout: 2000 }).toBeGreaterThan(themeHeight);
    const cards = [...tab.querySelectorAll('.atlas-dungeon-style-card')].map((card) => card.getBoundingClientRect());
    expect(cards).toHaveLength(DUNGEON_STYLES.length);
    expect(cards.filter((card) => card.top === cards[0]!.top)).toHaveLength(4);
    await expect.poll(() => box('.atlas-dungeon-wizard').bottom, { timeout: 2000 }).toBeLessThanOrEqual(700 - WIZARD_MARGIN);
    // The footer stays in sight; the step scrolls
    expect(box('.atlas-dungeon-wizard__footer').bottom).toBeLessThanOrEqual(700 - WIZARD_MARGIN);
  });

  it('puts the floor switcher of a dungeon of several floors centred at the card’s foot', async () => {
    await openWizard(1440, 860, { left: 300, top: 120, width: 320, height: 420 });
    expect(tab.querySelector('.atlas-dungeon-floor-switcher')).toBeNull();
    goTo('Layout');
    const more = [...tab.querySelectorAll<HTMLButtonElement>('.atlas-dungeon-stepper__button')].at(-1)!;
    act(() => more.click());
    act(() => more.click());
    await expect.poll(() => tab.querySelectorAll('.atlas-dungeon-floor-switcher [role="radio"]').length).toBe(3);
    const card = box('.atlas-dungeon-wizard-preview');
    const switcher = box('.atlas-dungeon-floor-switcher');
    expect(card.bottom - switcher.bottom).toBeCloseTo(computed('.atlas-dungeon-wizard-preview', 'borderTopWidth') + 12, 1);
    expect(Math.abs((switcher.left + switcher.right) / 2 - (card.left + card.right) / 2)).toBeLessThanOrEqual(0.5);
    const options = [...tab.querySelectorAll('.atlas-dungeon-floor-switcher [role="radio"]')].map((option) => option.getBoundingClientRect().width);
    expect(new Set(options).size).toBe(1);
  });

  it('stacks the card under the panel in a narrow view', async () => {
    await openWizard(520, 1000, { left: 100, top: 40, width: 320, height: 420 });
    const panel = box('.atlas-dungeon-wizard');
    const card = box('.atlas-dungeon-wizard-preview');
    expect(card.top).toBeCloseTo(panel.bottom + WIZARD_GAP, 0);
    expect(card.left).toBeGreaterThanOrEqual(WIZARD_MARGIN);
    expect(card.right).toBeLessThanOrEqual(520 - WIZARD_MARGIN);
  });
});
