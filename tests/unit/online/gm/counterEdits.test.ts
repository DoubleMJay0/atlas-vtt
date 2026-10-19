import { describe, expect, it } from 'vitest';
import { checkFieldEdit } from '../../../../src/app/online/gm/book/fieldEdit.ts';
import { checkRefill } from '../../../../src/app/online/gm/book/refillEdit.ts';
import type { CheckedEdit, EditInputs } from '../../../../src/app/online/gm/book/statblockChecks.ts';
import { statblockSheet } from '../../../../src/app/online/gm/book/statblockSheet.ts';
import { storedRead } from '../../../../src/app/online/gm/book/statblockSheets.ts';
import { sheetBase, type BookFieldMessage, type SheetRaw } from '../../../../src/app/online/protocol/index.ts';
import type { ResolvedStatblock } from '../../../../src/app/statblocks/model/resolvedTypes';
import type { StatblockTemplate } from '../../../../src/app/statblocks/model/templateTypes';
import { applyFrontmatterPatches } from '../../../../src/app/statblocks/notes/frontmatterPatch';
import { propertiesOf, templateOf } from './statblockNotes.ts';

const TEMPLATE: StatblockTemplate = {
  ...templateOf(
    [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'slots', label: 'Spell slots', type: 'counters', counterRows: [{ name: '1st level', max: 2, reset: 'Long rest' }] },
    ],
    [{ id: 'slots001', type: 'counters', field: 'slots' }],
  ),
  refills: [{ name: 'Short rest' }, { name: 'Long rest', includes: ['Short rest'] }],
};

const NOTE = `---
statblock: true
atlas-template: test-template-abc123
name: Ana
slots:
  - name: 1st level
    max: 4
    used: 1
    reset: Long rest
  - name: Ki
    max: 3
    used: 3
    reset: Short rest
    regain: 1d4
    colour: red
---
# Ana
`;

const ROWS = [
  { name: '1st level', max: 4, used: 1, reset: 'Long rest' },
  { name: 'Ki', max: 3, used: 3, reset: 'Short rest', regain: '1d4', colour: 'red' },
];
/** The rows as a page sends them back: the protocol's keys, no refill or formula as null. */
const SENT = [
  { name: '1st level', max: 4, used: 1, reset: 'Long rest', regain: null },
  { name: 'Ki', max: 3, used: 3, reset: 'Short rest', regain: '1d4' },
];

function inputsOf(text: string, template = TEMPLATE): EditInputs {
  const fields = propertiesOf(text) ?? {};
  const resolved: ResolvedStatblock = { path: 'Characters/Ana.md', source: { kind: 'atlas', templateId: template.id }, fields, template, templateStatus: 'ok', lookName: 'Test', meanings: {} };
  return { resolved, sent: statblockSheet({ resolved, definitions: [], resources: undefined }), read: (field) => storedRead(fields, field) };
}

const edit = (value: SheetRaw, base: { was: SheetRaw | undefined } = { was: ROWS }, cell?: [number, number]): BookFieldMessage =>
  ({ t: 'book-field', key: 'slots', base: sheetBase(base.was), value, ...(cell && { cell }) });

function slotsAfter(text: string, checked: CheckedEdit | null): unknown {
  expect(checked).not.toBeNull();
  const result = applyFrontmatterPatches(text, checked?.patches ?? []);
  expect(result.conflicts).toEqual([]);
  return propertiesOf(result.text)?.slots;
}

const withUsed = (uses: number[]): SheetRaw => SENT.map((row, index) => ({ ...row, used: uses[index] ?? row.used }));

describe('a player\'s change of their Counters', () => {
  const inputs = inputsOf(NOTE);

  it('writes a changed use, every other key of a row kept', () => {
    expect(slotsAfter(NOTE, checkFieldEdit(inputs, edit(withUsed([2, 3]))))).toEqual([{ ...ROWS[0], used: 2 }, ROWS[1]]);
  });

  it('writes the whole list with several rows changed at once', () => {
    expect(slotsAfter(NOTE, checkFieldEdit(inputs, edit(withUsed([0, 0]))))).toEqual([{ ...ROWS[0], used: 0 }, { ...ROWS[1], used: 0 }]);
  });

  it('gives a note that showed its preset rows rows of its own', () => {
    const bare = NOTE.replace(/slots:[\s\S]*?(?=---\n# Ana)/, '');
    const fresh = inputsOf(bare);
    expect(slotsAfter(bare, checkFieldEdit(fresh, edit([{ name: '1st level', max: 2, used: 1, reset: 'Long rest' }], { was: undefined }))))
      .toEqual([{ name: '1st level', max: 2, used: 1, reset: 'Long rest' }]);
  });

  it('refuses a changed maximum, name, refill or formula, another order or number of rows, and uses that are no whole number up to the maximum', () => {
    const refused: SheetRaw[] = [
      [{ ...SENT[0]!, max: 5 }, SENT[1]!],
      [{ ...SENT[0]!, name: '1st' }, SENT[1]!],
      [{ ...SENT[0]!, reset: 'Short rest' }, SENT[1]!],
      [{ ...SENT[0]!, reset: 'long rest' }, SENT[1]!],
      [{ ...SENT[0]!, reset: 'Long rest ' }, SENT[1]!],
      [{ ...SENT[0]!, reset: null }, SENT[1]!],
      [SENT[0]!, { ...SENT[1]!, regain: '1d6' }],
      [SENT[0]!, { ...SENT[1]!, regain: null }],
      [SENT[1]!, SENT[0]!],
      [SENT[0]!],
      withUsed([5, 3]),
      withUsed([1.5, 3]),
      withUsed([-1, 3]),
      [{ ...SENT[0]!, used: '1' }, SENT[1]!],
      [{ name: '1st level', max: 4, reset: 'Long rest' }, SENT[1]!],
      [{ ...SENT[0]!, colour: 'blue' }, SENT[1]!],
      [],
      null,
      'four',
    ];
    for (const value of refused) expect(checkFieldEdit(inputs, edit(value)), JSON.stringify(value)).toBeNull();
    expect(checkFieldEdit(inputs, edit(1, { was: ROWS }, [0, 0]))).toBeNull();
  });

  it('never changes a note whose rows name a refill the template does not define', () => {
    const old = NOTE.replace('reset: Long rest', 'reset: long-rest');
    expect(checkFieldEdit(inputsOf(old), edit([{ ...SENT[0]!, reset: 'long-rest', used: 2 }, SENT[1]!], { was: [{ ...ROWS[0], reset: 'long-rest' }, ROWS[1]] }))).toBeNull();
  });

  it('refuses an edit made against an older value, and one of a field players may only read', () => {
    expect(checkFieldEdit(inputs, edit(withUsed([2, 3]), { was: [{ ...ROWS[0], used: 0 }, ROWS[1]] }))).toBeNull();
    const readOnly = inputsOf(NOTE, { ...TEMPLATE, players: { slots: 'read' } });
    expect(checkFieldEdit(readOnly, edit(withUsed([2, 3])))).toBeNull();
  });
});

describe('a player\'s refill of their sheet', () => {
  const inputs = inputsOf(NOTE);
  const rolled: string[] = [];
  const roll = (total: number | null) => (formula: string, flavor: string): number | null => {
    rolled.push(`${formula} ${flavor}`);
    return total;
  };
  const refill = (name: string): { readonly t: 'book-refill'; readonly refill: string } => ({ t: 'book-refill', refill: name });

  it('gives back what the refill and those it brings along name, rolling what a row regains', () => {
    rolled.length = 0;
    expect(slotsAfter(NOTE, checkRefill(inputs, refill('Long rest'), roll(2)))).toEqual([{ ...ROWS[0], used: 0 }, { ...ROWS[1], used: 1 }]);
    expect(rolled).toEqual(['1d4 Ki (Long rest)']);
    expect(slotsAfter(NOTE, checkRefill(inputs, refill('Short rest'), roll(9)))).toEqual([ROWS[0], { ...ROWS[1], used: 0 }]);
  });

  it('refuses a refill the template does not define or the sheet did not offer, and one whose roll was not made', () => {
    expect(checkRefill(inputs, refill('Dawn'), roll(1))).toBeNull();
    expect(checkRefill(inputs, refill('long rest'), roll(1))).toBeNull();
    expect(checkRefill(inputs, refill('Short rest'), roll(null))).toBeNull();
    const offeredNone = { ...inputs, sent: inputs.sent && { ...inputs.sent, refills: [] } };
    expect(checkRefill(offeredNone, refill('Long rest'), roll(1))).toBeNull();
  });

  it('changes no value players may only read, and writes nothing where nothing comes back', () => {
    const readOnly = inputsOf(NOTE, { ...TEMPLATE, players: { slots: 'read' } });
    expect(checkRefill(readOnly, refill('Long rest'), roll(1))).toBeNull();
    const rested = NOTE.replace('used: 1', 'used: 0').replace('used: 3', 'used: 0');
    expect(checkRefill(inputsOf(rested), refill('Long rest'), roll(1))).toEqual({ patches: [], written: [] });
  });
});
