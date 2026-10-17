import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TemplateLibrary } from '../../../../src/app/statblocks/library/TemplateLibrary';
import { TEMPLATE_FORMAT, type StatblockTemplate } from '../../../../src/app/statblocks/model/templateTypes';
import { blockOf, renderPane, type PaneHarness } from './paneKit';

vi.mock('../../../../src/app/services/AssetService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/app/services/AssetService')>();
  const assets = {
    getCollections: async () => [{ id: 'campaign', name: 'Campaign' }],
    getAssets: async () => [],
    getDefaultCollectionId: () => 'campaign',
    loadedTokenAssets: () => [],
    getCollectionSettings: () => ({ conditions: [] }),
  };
  return { ...actual, AssetService: { getInstance: () => assets } };
});

const TEMPLATE: StatblockTemplate = {
  format: TEMPLATE_FORMAT,
  version: 1,
  id: 'counters-k7m2qa',
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'slots', label: 'Spell slots', type: 'counters', counterRows: [{ name: '1st level', max: 2, reset: 'long-rest' }] },
  ],
  layout: { maxColumns: 1, blocks: [{ id: 'title001', type: 'title', field: 'name', level: 1 }, { id: 'slots001', type: 'counters', field: 'slots' }] },
};

const apps: App[] = [];
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const app of apps.splice(0)) TemplateLibrary.release(app);
});

async function pane(values: Record<string, unknown>): Promise<PaneHarness> {
  vi.spyOn(TemplateLibrary.prototype, 'get').mockReturnValue({
    template: TEMPLATE, name: 'Counters', status: 'ok', builtIn: false, path: 'Templates/Counters.atlastemplate',
  });
  const harness = await renderPane({ frontmatter: { statblock: true, 'atlas-template': TEMPLATE.id, name: 'Elowen', ...values } });
  apps.push(harness.app);
  return harness;
}

const block = (harness: PaneHarness): HTMLElement => blockOf(harness.result.container, 'slots001');
const press = async (button: HTMLElement): Promise<void> => { await act(async () => { fireEvent.click(button); }); };

describe('Counters in the statblock pane', () => {
  it('writes a pressed pip as one patch of the whole value, with the old value as its base', async () => {
    const slots = [{ name: '1st level', max: 3, used: 0, reset: 'long-rest' }, { name: 'Ki', max: 2, used: 1, reset: 'short-rest' }];
    const harness = await pane({ slots });
    const pips = within(block(harness)).getByRole('group', { name: '1st level' });
    await press(within(pips).getByRole('button', { name: '1st level 3 of 3' }));
    expect(harness.writer.patches()).toEqual([{
      op: 'set', path: ['slots'], base: slots, next: [{ ...slots[0], used: 1 }, slots[1]],
    }]);
  });

  it('gives back what a rest refills, and a statblock showing its preset rows gets them as its own', async () => {
    const harness = await pane({});
    await press(within(block(harness)).getByRole('button', { name: '1st level 2 of 2' }));
    expect(harness.writer.patches()).toEqual([{
      op: 'set', path: ['slots'], base: undefined, next: [{ name: '1st level', max: 2, used: 1, reset: 'long-rest' }],
    }]);
    cleanup();
    const used = await pane({ slots: [{ name: 'Ki', max: 2, used: 2, reset: 'short-rest' }, { name: 'Slots', max: 1, used: 1, reset: 'long-rest' }] });
    expect(screen.getByRole('button', { name: 'Short rest' })).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Short rest' }));
    expect(used.writer.patches().at(-1)).toMatchObject({ next: [{ name: 'Ki', used: 0 }, { name: 'Slots', used: 1 }] });
  });

  it('steps a row of many uses with − and +', async () => {
    const harness = await pane({ slots: [{ name: 'Sorcery points', max: 10, used: 3 }] });
    await press(within(block(harness)).getByRole('button', { name: 'Decrease Sorcery points' }));
    expect(harness.writer.patches().at(-1)).toMatchObject({ next: [{ name: 'Sorcery points', max: 10, used: 4 }] });
  });
});
