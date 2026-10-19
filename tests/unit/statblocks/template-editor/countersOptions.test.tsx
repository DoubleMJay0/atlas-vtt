// @vitest-environment jsdom
import { cleanup, fireEvent, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { insertItems } from '../../../../src/app/statblocks/editor/template-editor/insertItems';
import { newFieldFor } from '../../../../src/app/statblocks/model/newFields';
import type { StatblockTemplate, TemplateField } from '../../../../src/app/statblocks/model/templateTypes';
import { FakeSession, sampleTemplate } from './editorKit';
import { mountEditor, tileOptions, typeAndLeave } from './sidePanesKit';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  Element.prototype.scrollIntoView = vi.fn();
  Range.prototype.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 40, 16);
});
afterAll(() => { MotionGlobalConfig.skipAnimations = false; });
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const SLOTS: TemplateField = {
  key: 'slots', label: 'Spell slots', type: 'counters',
  counterRows: [{ name: '1st level', max: 4, reset: 'Long rest' }, { name: '2nd level', max: 3, reset: 'Long rest' }],
};

function withCounters(): StatblockTemplate {
  const sample = sampleTemplate();
  return {
    ...sample,
    refills: [{ name: 'Short rest' }, { name: 'Long rest', includes: ['Short rest'] }],
    fields: [...sample.fields, SLOTS],
    layout: { ...sample.layout, blocks: [...sample.layout.blocks, { id: 'slots001', type: 'counters', field: 'slots' }] },
  };
}

const rows = (session: FakeSession): TemplateField['counterRows'] => session.template.fields.find((field) => field.key === 'slots')?.counterRows;

function open(): { session: FakeSession; options: HTMLElement } {
  const session = new FakeSession(withCounters());
  const { frame } = mountEditor(session);
  fireEvent.click(frame('slots001'));
  return { session, options: tileOptions() };
}

describe('a Counters tile in the template editor', () => {
  it('is one of the kinds the dock and the insert menu offer', () => {
    expect(insertItems().map((item) => item.label)).toContain('Counters');
  });

  it('makes a Counters property when a new tile is named', () => {
    expect(newFieldFor({ id: 'slots002', type: 'counters', field: '' }, 'ki', 'Ki')).toEqual({ key: 'ki', label: 'Ki', type: 'counters' });
  });

  it('adds a row in its Options, one step', () => {
    const { session, options } = open();
    const add = within(options).getByPlaceholderText('Add a row, like Ki');
    fireEvent.change(add, { target: { value: 'Arcane Recovery' } });
    fireEvent.keyDown(add, { key: 'Enter' });
    expect(rows(session)).toEqual([...SLOTS.counterRows!, { name: 'Arcane Recovery', max: 1 }]);
    expect(session.steps).toBe(1);
  });

  it('removes a row and moves one, one step each', () => {
    const { session, options } = open();
    fireEvent.click(within(options).getByRole('button', { name: 'Move 2nd level up' }));
    expect(rows(session)?.map((row) => row.name)).toEqual(['2nd level', '1st level']);
    expect(session.steps).toBe(1);
    fireEvent.click(within(tileOptions()).getByRole('button', { name: 'Remove 1st level' }));
    expect(rows(session)?.map((row) => row.name)).toEqual(['2nd level']);
    expect(session.steps).toBe(2);
  });

  it('renames a row and sets its uses, its refill and what it regains, typing being one step', () => {
    const { session, options } = open();
    typeAndLeave(within(options).getByRole('textbox', { name: 'Row 1' }), '1', '1s', '1st');
    expect(rows(session)?.[0]?.name).toBe('1st');
    expect(session.steps).toBe(1);
    typeAndLeave(within(tileOptions()).getByRole('textbox', { name: 'Uses of 1st' }), '2');
    expect(rows(session)?.[0]?.max).toBe(2);
    expect(session.steps).toBe(2);
    typeAndLeave(within(tileOptions()).getByRole('textbox', { name: 'Uses 1st regains' }), '1d', '1d4');
    expect(rows(session)?.[0]).toEqual({ name: '1st', max: 2, reset: 'Long rest', regain: '1d4' });
    expect(session.steps).toBe(3);
    fireEvent.click(within(tileOptions()).getByRole('combobox', { name: 'Refill of 1st' }));
    expect(within(document.body).getAllByRole('option').map((option) => option.textContent)).toEqual(['None', 'Short rest', 'Long rest']);
    fireEvent.click(within(document.body).getByRole('option', { name: 'Short rest' }));
    expect(rows(session)?.[0]).toEqual({ name: '1st', max: 2, reset: 'Short rest', regain: '1d4' });
    fireEvent.click(within(tileOptions()).getByRole('combobox', { name: 'Refill of 1st' }));
    fireEvent.click(within(document.body).getByRole('option', { name: 'None' }));
    expect(rows(session)?.[0]).toEqual({ name: '1st', max: 2, regain: '1d4' });
    expect(session.steps).toBe(5);
  });

  it('lists the refills the whole sheet shares, and adds one, one step', () => {
    const { session, options } = open();
    expect(within(options).getByText(/Refills belong to the whole sheet/)).toBeTruthy();
    const add = within(options).getByPlaceholderText('Add a refill, like Dawn');
    fireEvent.change(add, { target: { value: 'Dawn' } });
    fireEvent.keyDown(add, { key: 'Enter' });
    expect(session.template.refills).toEqual([{ name: 'Short rest' }, { name: 'Long rest', includes: ['Short rest'] }, { name: 'Dawn' }]);
    expect(session.steps).toBe(1);
    fireEvent.change(within(tileOptions()).getByPlaceholderText('Add a refill, like Dawn'), { target: { value: 'Dawn' } });
    fireEvent.keyDown(within(tileOptions()).getByPlaceholderText('Add a refill, like Dawn'), { key: 'Enter' });
    expect(session.steps).toBe(1);
  });

  it('renames a refill and carries the rows it refills and the refills bringing it along with it, one step', () => {
    const { session, options } = open();
    typeAndLeave(within(options).getByRole('textbox', { name: 'Refill 1' }), 'Breather');
    expect(session.template.refills).toEqual([{ name: 'Breather' }, { name: 'Long rest', includes: ['Breather'] }]);
    expect(session.steps).toBe(1);
    typeAndLeave(within(tileOptions()).getByRole('textbox', { name: 'Refill 2' }), 'Night');
    expect(rows(session)?.map((row) => row.reset)).toEqual(['Night', 'Night']);
    expect(session.steps).toBe(2);
    typeAndLeave(within(tileOptions()).getByRole('textbox', { name: 'Refill 2' }), 'Breather');
    expect(session.template.refills?.map((refill) => refill.name)).toEqual(['Breather', 'Night']);
    expect(session.steps).toBe(2);
  });

  it('sets which refills one brings along, moves one and removes one, one step each', () => {
    const { session, options } = open();
    fireEvent.click(within(options).getByRole('button', { name: 'Short rest', pressed: true }));
    expect(session.template.refills?.[1]).toEqual({ name: 'Long rest' });
    fireEvent.click(within(tileOptions()).getByRole('button', { name: 'Move Long rest up' }));
    expect(session.template.refills?.map((refill) => refill.name)).toEqual(['Long rest', 'Short rest']);
    fireEvent.click(within(tileOptions()).getByRole('button', { name: 'Remove Long rest' }));
    expect(session.template.refills).toEqual([{ name: 'Short rest' }]);
    expect(rows(session)?.map((row) => row.reset)).toEqual([undefined, undefined]);
    expect(session.steps).toBe(3);
  });

  it('offers no Roll as a bonus', () => {
    const { options } = open();
    expect(within(options).queryByRole('switch', { name: 'Roll as a bonus' })).toBeNull();
  });
});
