import '../setup/obsidianDom';
import { createElement } from 'react';
import { act } from '@testing-library/react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { App } from 'obsidian';
import css from '../../styles/main.scss?inline';
import { DUNGEON_STYLES } from '../../src/app/dungeons/styleCatalog';
import { DungeonWorkerClient } from '../../src/app/dungeons/worker/DungeonWorkerClient';
import { DungeonGeneratorPanel } from '../../src/app/packages/components/dungeon-generator/DungeonGeneratorPanel';

/**
 * The dungeon generator over the Atlas view, laid out by the plugin's real stylesheet and drawn by the
 * real worker. The variables stand in for Obsidian's theme.
 */
const THEME = `
  body { margin: 0; font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; --background-primary: #1e1e1e; --background-secondary: #262626; --background-modifier-border: #363636;
    --divider-color: #363636; --text-normal: #dadada; --text-muted: #b3b3b3; --interactive-accent: #7f6df2; --radius-s: 4px; --radius-m: 8px; --radius-l: 12px; --radius-xl: 16px;
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

/** The overlay over an Atlas view of `width` × `height` px (here the page, as a leaf contains it). */
async function openTab(width: number, height: number): Promise<void> {
  await page.viewport(width, height);
  view = document.body.createDiv({ cls: 'atlas-vtt-plugin' });
  tab = view.createDiv({ cls: 'atlas-dungeon-generator-overlay' });
  root = createRoot(tab);
  const header = createElement('button', { className: 'atlas-close-btn' }, '×');
  act(() => root!.render(createElement(DungeonGeneratorPanel, { app, collectionId: 'Dungeons', initialName: 'Crypt', onCreated: () => {}, header })));
}

const box = (selector: string): DOMRect => tab.querySelector(selector)!.getBoundingClientRect();

describe('the dungeon generator over the Atlas view', () => {
  beforeEach(() => {
    document.head.append(style);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    view.remove();
    style.remove();
    DungeonWorkerClient.release(app);
  });

  it('fills the view: the map in the main area, the settings in a sidebar on the right under the close button, its actions at the foot', async () => {
    await openTab(1440, 860);
    const frame = tab.getBoundingClientRect();
    expect([frame.width, frame.height]).toEqual([1440, 860]);
    expect(box('.atlas-dungeon-generator').width).toBe(frame.width);
    const header = box('.atlas-dungeon-generator__header');
    const close = box('.atlas-close-btn');
    expect(header.top).toBe(frame.top);
    expect(close.right).toBe(frame.right - 8);
    expect(close.top).toBe(frame.top + 8);
    const sidebar = box('.atlas-dungeon-generator__sidebar');
    expect(sidebar.right).toBe(frame.right);
    expect([sidebar.left, sidebar.top, sidebar.bottom]).toEqual([header.left, header.bottom, frame.bottom]);
    expect(sidebar.width).toBeGreaterThanOrEqual(320);
    expect(sidebar.width).toBeLessThanOrEqual(440);
    const preview = box('.atlas-dungeon-generator__preview');
    expect([preview.left, preview.top, preview.right, preview.bottom]).toEqual([frame.left, frame.top, sidebar.left, frame.bottom]);
    const footer = box('.atlas-dungeon-generator__footer');
    expect(footer.bottom).toBe(frame.bottom);
    expect(footer.right).toBe(sidebar.right);
    expect(footer.left).toBeGreaterThanOrEqual(sidebar.left);

    // The map is drawn as large as the main area allows
    await expect.poll(() => tab.querySelector('canvas.atlas-dungeon-preview__canvas'), { timeout: 20_000 }).not.toBeNull();
    const canvas = box('canvas.atlas-dungeon-preview__canvas');
    const room = { width: preview.width - 48, height: preview.height - 48 };
    expect(Math.max(canvas.width / room.width, canvas.height / room.height)).toBeCloseTo(1, 1);
  });

  it('shows the style gallery without scrolling, as many cards a row as the sidebar holds', async () => {
    await openTab(1440, 900);
    const gallery = tab.querySelector('.atlas-dungeon-style-gallery')!;
    const cards = [...gallery.querySelectorAll('.atlas-dungeon-style-card')].map((card) => card.getBoundingClientRect());
    expect(cards).toHaveLength(DUNGEON_STYLES.length);
    const settings = box('.atlas-dungeon-generator__settings');
    expect(cards[0]!.top).toBeLessThan(settings.bottom - cards[0]!.height);
    expect(cards.filter((card) => card.top === cards[0]!.top).length).toBeGreaterThanOrEqual(3);
  });

  it('stacks the sidebar under the map in a narrow view, the close button still in the top right corner', async () => {
    await openTab(600, 900);
    const frame = tab.getBoundingClientRect();
    const header = box('.atlas-dungeon-generator__header');
    const preview = box('.atlas-dungeon-generator__preview');
    const sidebar = box('.atlas-dungeon-generator__sidebar');
    expect([header.top, header.width]).toEqual([frame.top, frame.width]);
    expect(box('.atlas-close-btn').right).toBe(frame.right - 8);
    expect(preview.top).toBe(header.bottom);
    expect(preview.width).toBe(frame.width);
    expect(sidebar.width).toBe(frame.width);
    expect(sidebar.top).toBe(preview.bottom);
    expect(sidebar.bottom).toBe(frame.bottom);
  });
});
