import { describe, expect, it } from 'vitest';
import type { TemplateField } from '../../../../src/app/statblocks/model/templateTypes';
import { offeredRefills, refillSheet, type RegainRoll } from '../../../../src/app/statblocks/values/counterRefill';
import {
  readCounterRows, shownCounterRows, templateRefills, withCounterUsed,
} from '../../../../src/app/statblocks/values/counterValues';
import { valueMisfit } from '../../../../src/app/statblocks/values/valueFit';

const REFILLS = templateRefills({ refills: [{ name: 'Short rest' }, { name: 'Long rest', includes: ['Short rest', 'Nap'] }, { name: 'Dawn' }] });
const KNOWN = new Set(REFILLS.map((refill) => refill.name));

const FIELD: TemplateField = {
  key: 'slots', label: 'Spell slots', type: 'counters',
  counterRows: [{ name: '1st level', max: 2, reset: 'Long rest' }, { name: '2nd level', max: 0, reset: 'Long rest' }],
};
const CHARGES: TemplateField = { key: 'charges', label: 'Charges', type: 'counters' };

const never: RegainRoll = () => {
  throw new Error('nothing regains a formula here');
};

describe('a Counters value', () => {
  it('reads rows, a missing used as none, their refill and formula as written', () => {
    expect(readCounterRows([{ name: 'Ki', max: 3 }, { name: 'Wand', max: 7, used: 1, reset: 'Dawn', regain: '1d6+1' }], KNOWN)).toEqual([
      { name: 'Ki', max: 3, used: 0, reset: null, regain: null },
      { name: 'Wand', max: 7, used: 1, reset: 'Dawn', regain: '1d6+1' },
    ]);
  });

  it('reads the template\'s refills each named once, bringing along only others it defines', () => {
    expect(REFILLS).toEqual([
      { name: 'Short rest', includes: [] },
      { name: 'Long rest', includes: ['Short rest'] },
      { name: 'Dawn', includes: [] },
    ]);
  });

  it('clamps nothing: a row used past its maximum, a broken maximum, a refill the template lacks or a regain that is no formula makes the value a misfit', () => {
    const misfits = [
      [{ name: 'Ki', max: 2, used: 3 }], [{ name: 'Ki', max: 1.5 }], [{ name: 'Ki', max: 1, reset: 'long-rest' }],
      [{ name: 'Ki', max: 1, reset: 'Dawn', regain: 'lots' }], [{ name: 'Ki', max: 1, regain: '3' }], 'four',
    ];
    for (const value of misfits) {
      expect(readCounterRows(value, KNOWN)).toBeNull();
      expect(valueMisfit(FIELD, value, KNOWN)?.label).toBe('Not counters');
    }
    expect(valueMisfit(FIELD, [{ name: 'Ki', max: 2, used: 1, reset: 'Short rest' }], KNOWN)).toBeNull();
  });

  it('shows the preset rows while the note holds none, a refill the template lacks read as none', () => {
    expect(shownCounterRows(FIELD, undefined, KNOWN)).toEqual([
      { name: '1st level', max: 2, used: 0, reset: 'Long rest', regain: null },
      { name: '2nd level', max: 0, used: 0, reset: 'Long rest', regain: null },
    ]);
    expect(shownCounterRows(FIELD, undefined, new Set())?.[0]?.reset).toBeNull();
  });

  it('changes one row\'s uses, keeping the rest of each row; a note without rows gets the preset rows', () => {
    expect(withCounterUsed(FIELD, [{ name: 'Ki', max: 3, used: 0, colour: 'red' }], KNOWN, 0, 2)).toEqual([{ name: 'Ki', max: 3, used: 2, colour: 'red' }]);
    expect(withCounterUsed(FIELD, undefined, KNOWN, 0, 1)).toEqual([
      { name: '1st level', max: 2, used: 1, reset: 'Long rest' },
      { name: '2nd level', max: 0, used: 0, reset: 'Long rest' },
    ]);
    expect(withCounterUsed(FIELD, [{ name: 'Ki', max: 3, used: 3 }], KNOWN, 0, 3)).toBeNull();
    expect(withCounterUsed(FIELD, [{ name: 'Ki', max: 3, used: 3 }], KNOWN, 1, 0)).toBeNull();
  });
});

describe('a refill of the whole sheet', () => {
  const slots = [
    { name: 'Ki', max: 3, used: 2, reset: 'Short rest' },
    { name: 'Slots', max: 2, used: 2, reset: 'Long rest' },
    { name: 'Wish', max: 1, used: 1 },
  ];
  const charges = [{ name: 'Wand', max: 7, used: 6, reset: 'Dawn', regain: '1d6+1' }];
  const targets = [{ field: FIELD, value: slots }, { field: CHARGES, value: charges }];

  it('gives back the rows the refill names and those of the refills it brings along, in every field', () => {
    expect(refillSheet(targets, REFILLS, KNOWN, 'Short rest', never)).toEqual([{ field: FIELD, base: slots, next: [{ ...slots[0], used: 0 }, slots[1], slots[2]] }]);
    expect(refillSheet(targets, REFILLS, KNOWN, 'Long rest', never)?.[0]?.next).toEqual([{ ...slots[0], used: 0 }, { ...slots[1], used: 0 }, slots[2]]);
  });

  it('rolls what a row regains, named by the row and the refill, and keeps its uses within none used', () => {
    const rolled: string[] = [];
    const roll = (total: number): RegainRoll => (formula, flavor) => {
      rolled.push(`${formula} ${flavor}`);
      return total;
    };
    expect(refillSheet(targets, REFILLS, KNOWN, 'Dawn', roll(4))).toEqual([{ field: CHARGES, base: charges, next: [{ ...charges[0], used: 2 }] }]);
    expect(rolled).toEqual(['1d6+1 Wand (Dawn)']);
    expect(refillSheet(targets, REFILLS, KNOWN, 'Dawn', roll(9))?.[0]?.next).toEqual([{ ...charges[0], used: 0 }]);
    expect(refillSheet(targets, REFILLS, KNOWN, 'Dawn', roll(-2))).toEqual([]);
  });

  it('refuses a refill the template does not define, and one whose roll was not made', () => {
    expect(refillSheet(targets, REFILLS, KNOWN, 'Session', never)).toBeNull();
    expect(refillSheet(targets, REFILLS, KNOWN, 'Dawn', () => null)).toBeNull();
  });

  it('gives back nothing where nothing is used, and leaves a field that is no list of counters alone', () => {
    const rested = [{ field: FIELD, value: [{ ...slots[0], used: 0 }] }, { field: CHARGES, value: 'broken' }];
    expect(refillSheet(rested, REFILLS, KNOWN, 'Long rest', never)).toEqual([]);
  });

  it('offers the refills that would refill a drawn row of any field, in template order', () => {
    expect(offeredRefills(REFILLS, targets, KNOWN).map((refill) => refill.name)).toEqual(['Short rest', 'Long rest', 'Dawn']);
    expect(offeredRefills(REFILLS, [{ field: FIELD, value: [slots[1]] }], KNOWN).map((refill) => refill.name)).toEqual(['Long rest']);
  });
});
