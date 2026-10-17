import { describe, expect, it } from 'vitest';
import type { TemplateField } from '../../../../src/app/statblocks/model/templateTypes';
import {
  afterCounterRest, countersRests, readCounterRows, shownCounterRows, withCounterUsed,
} from '../../../../src/app/statblocks/values/counterValues';
import { valueMisfit } from '../../../../src/app/statblocks/values/valueFit';

const FIELD: TemplateField = {
  key: 'slots', label: 'Spell slots', type: 'counters',
  counterRows: [{ name: '1st level', max: 2, reset: 'long-rest' }, { name: '2nd level', max: 0, reset: 'long-rest' }],
};

describe('a Counters value', () => {
  it('reads rows, a missing used as none', () => {
    expect(readCounterRows([{ name: 'Ki', max: 3 }, { name: 'Slots', max: 2, used: 1, reset: 'long-rest' }])).toEqual([
      { name: 'Ki', max: 3, used: 0, reset: null },
      { name: 'Slots', max: 2, used: 1, reset: 'long-rest' },
    ]);
  });

  it('clamps nothing: a row used past its maximum, a broken maximum or an unknown rest is no counter, and the value a misfit', () => {
    for (const value of [[{ name: 'Ki', max: 2, used: 3 }], [{ name: 'Ki', max: 1.5 }], [{ name: 'Ki', max: 1, reset: 'dawn' }], 'four']) {
      expect(readCounterRows(value)).toBeNull();
      expect(valueMisfit(FIELD, value)?.label).toBe('Not counters');
    }
    expect(valueMisfit(FIELD, [{ name: 'Ki', max: 2, used: 1 }])).toBeNull();
  });

  it('shows the preset rows while the note holds none', () => {
    expect(shownCounterRows(FIELD, undefined)).toEqual([
      { name: '1st level', max: 2, used: 0, reset: 'long-rest' },
      { name: '2nd level', max: 0, used: 0, reset: 'long-rest' },
    ]);
  });

  it('changes one row\'s uses, keeping the rest of each row; a note without rows gets the preset rows', () => {
    expect(withCounterUsed(FIELD, [{ name: 'Ki', max: 3, used: 0, colour: 'red' }], 0, 2)).toEqual([{ name: 'Ki', max: 3, used: 2, colour: 'red' }]);
    expect(withCounterUsed(FIELD, undefined, 0, 1)).toEqual([
      { name: '1st level', max: 2, used: 1, reset: 'long-rest' },
      { name: '2nd level', max: 0, used: 0, reset: 'long-rest' },
    ]);
    expect(withCounterUsed(FIELD, [{ name: 'Ki', max: 3, used: 3 }], 0, 3)).toBeNull();
    expect(withCounterUsed(FIELD, [{ name: 'Ki', max: 3, used: 3 }], 1, 0)).toBeNull();
  });

  it('refills short-rest rows on a short rest, and those and long-rest rows on a long rest', () => {
    const value = [
      { name: 'Ki', max: 3, used: 2, reset: 'short-rest' },
      { name: 'Slots', max: 2, used: 2, reset: 'long-rest' },
      { name: 'Wish', max: 1, used: 1 },
    ];
    expect(afterCounterRest(FIELD, value, 'short-rest')).toEqual([{ ...value[0], used: 0 }, value[1], value[2]]);
    expect(afterCounterRest(FIELD, value, 'long-rest')).toEqual([{ ...value[0], used: 0 }, { ...value[1], used: 0 }, value[2]]);
    expect(afterCounterRest(FIELD, [value[2]!], 'long-rest')).toBeNull();
    expect(countersRests(readCounterRows(value) ?? [])).toEqual(['short-rest', 'long-rest']);
    expect(countersRests(readCounterRows([value[1]!]) ?? [])).toEqual(['long-rest']);
  });
});
