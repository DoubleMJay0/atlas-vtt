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

const rolls = vi.hoisted(() => ({ made: [] as { formula: string; flavor: string | undefined }[], total: 3 }));
vi.mock('../../../../src/app/services/statblockRolls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/app/services/statblockRolls')>();
  return {
    ...actual,
    rollStatblockDice: (_app: unknown, formula: string, source: { abilityName?: string }) => {
      rolls.made.push({ formula, flavor: source.abilityName });
      return { total: rolls.total };
    },
  };
});

const TEMPLATE: StatblockTemplate = {
  format: TEMPLATE_FORMAT,
  version: 1,
  id: 'counters-k7m2qa',
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'slots', label: 'Spell slots', type: 'counters', counterRows: [{ name: '1st level', max: 2, reset: 'Long rest' }] },
    { key: 'charges', label: 'Charges', type: 'counters' },
  ],
  layout: {
    maxColumns: 1,
    blocks: [
      { id: 'title001', type: 'title', field: 'name', level: 1 }, { id: 'slots001', type: 'counters', field: 'slots' },
      { id: 'charge01', type: 'counters', field: 'charges' },
    ],
  },
  refills: [{ name: 'Short rest' }, { name: 'Long rest', includes: ['Short rest'] }, { name: 'Dawn' }],
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
    const slots = [{ name: '1st level', max: 3, used: 0, reset: 'Long rest' }, { name: 'Ki', max: 2, used: 1, reset: 'Short rest' }];
    const harness = await pane({ slots });
    const pips = within(block(harness)).getByRole('group', { name: '1st level' });
    await press(within(pips).getByRole('button', { name: '1st level 3 of 3' }));
    expect(harness.writer.patches()).toEqual([{
      op: 'set', path: ['slots'], base: slots, next: [{ ...slots[0], used: 1 }, slots[1]],
    }]);
  });

  it('gives a statblock showing its preset rows them as its own with its first change', async () => {
    const harness = await pane({});
    await press(within(block(harness)).getByRole('button', { name: '1st level 2 of 2' }));
    expect(harness.writer.patches()).toEqual([{
      op: 'set', path: ['slots'], base: undefined, next: [{ name: '1st level', max: 2, used: 1, reset: 'Long rest' }],
    }]);
  });

  it('shows one row of refill buttons for the whole sheet, named as the template names them, none in a block', async () => {
    const harness = await pane({
      slots: [{ name: 'Ki', max: 2, used: 2, reset: 'Short rest' }, { name: 'Slots', max: 1, used: 1, reset: 'Long rest' }],
      charges: [{ name: 'Wand', max: 7, used: 2, reset: 'Dawn', regain: '1d6+1' }],
    });
    const row = harness.result.container.querySelector<HTMLElement>('.atlas-sb-refills');
    expect(within(row!).getAllByRole('button').map((button) => button.textContent)).toEqual(['Short rest', 'Long rest', 'Dawn']);
    expect(harness.result.container.querySelectorAll('.atlas-sb-refills')).toHaveLength(1);
    expect(within(block(harness)).queryByRole('button', { name: 'Long rest' })).toBeNull();
  });

  it('refills the rows of every block the refill names in one batch, one patch per field', async () => {
    rolls.made.length = 0;
    const slots = [{ name: 'Ki', max: 2, used: 2, reset: 'Short rest' }, { name: 'Slots', max: 1, used: 1, reset: 'Long rest' }];
    const charges = [{ name: 'Wand', max: 7, used: 2, reset: 'Long rest', regain: '1d6+1' }];
    const harness = await pane({ slots, charges });
    await press(screen.getByRole('button', { name: 'Long rest' }));
    expect(harness.writer.patches()).toEqual([
      { op: 'set', path: ['slots'], base: slots, next: [{ ...slots[0], used: 0 }, { ...slots[1], used: 0 }] },
      { op: 'set', path: ['charges'], base: charges, next: [{ ...charges[0], used: 0 }] },
    ]);
    expect(rolls.made).toEqual([{ formula: '1d6+1', flavor: 'Wand (Long rest)' }]);
  });

  it('rolls what a row regains and takes that many off its used', async () => {
    rolls.total = 3;
    const harness = await pane({ charges: [{ name: 'Wand', max: 7, used: 5, reset: 'Dawn', regain: '1d6+1' }] });
    await press(screen.getByRole('button', { name: 'Dawn' }));
    expect(harness.writer.patches().at(-1)).toMatchObject({ path: ['charges'], next: [{ name: 'Wand', used: 2 }] });
  });

  it('steps a row of many uses with − and +', async () => {
    const harness = await pane({ slots: [{ name: 'Sorcery points', max: 10, used: 3 }] });
    await press(within(block(harness)).getByRole('button', { name: 'Decrease Sorcery points' }));
    expect(harness.writer.patches().at(-1)).toMatchObject({ next: [{ name: 'Sorcery points', max: 10, used: 4 }] });
  });
});
