import { describe, expect, it } from 'vitest';
import { MAX_REST_CHANGES, MAX_REST_ROLL, MAX_REST_TEXT, parseLogEntry } from '../../../../src/app/online/protocol/index.ts';
import { restRecordOf } from '../../../../src/app/online/gm/log/restEntry.ts';
import { restRulesText } from '../../../../src/app/online/gm/book/restRules.ts';
import type { RestSummary } from '../../../../src/app/recovery/restEvents';
import type { RestChange, RestPlan } from '../../../../src/app/recovery/restTypes';

const change = (label: string, rolls: RestChange['rolls'] = []): RestChange => ({ target: { kind: 'resource', key: 'hp' }, label, from: 4, to: 13, rolls });

describe('a rest in the table\'s log', () => {
  it('cuts every text to what the protocol carries, as shown, so the entry reads back exactly', () => {
    const long = 'Very  long\tname '.repeat(20);
    const rolls = Array.from({ length: 30 }, () => ({ formula: '1d8+(2)', total: 7 }));
    const summary: RestSummary = {
      characterId: 'pc', characterName: long, notePath: 'n.md', button: { id: 'long', name: long },
      changes: [change(long, rolls), ...Array.from({ length: 20 }, (_, index) => change(`Row ${index}`))],
      skipped: [{ index: 0, rule: { target: { kind: 'condition', id: 'x' }, does: 'clear' }, label: '  ', reason: { kind: 'no-token', id: 'x' } }],
      text: '',
    };
    const record = restRecordOf(summary);
    expect([...record.character]).toHaveLength(MAX_REST_TEXT);
    expect(record.character.endsWith('…')).toBe(true);
    expect(record.changes).toHaveLength(MAX_REST_CHANGES);
    expect([...(record.changes[0]?.roll ?? '')].length).toBeLessThanOrEqual(MAX_REST_ROLL);
    expect(record.changes[0]?.roll?.startsWith('1d8+2 = 7, 1d8+2 = 7')).toBe(true);
    // A skipped rule whose name shows nothing is left out.
    expect(record.skipped).toBeUndefined();
    const entry = { id: 'e'.repeat(24), at: 1, who: 'gm', name: 'GM', kind: 'rest', ...record };
    expect(parseLogEntry(JSON.parse(JSON.stringify(entry)))).toEqual(entry);
  });
});

describe('what a rest request will do, as its card says it', () => {
  it('names each rule that changes something, a spend by its count', () => {
    const hp = { kind: 'resource' as const, key: 'hp', label: 'HP', definition: { key: 'hp', name: 'HP', field: 'hp', direction: 'drains' as const, color: '#c33' }, value: { current: 4, max: 20 } };
    const exhaustion = { kind: 'condition' as const, id: 'ex', label: 'Exhaustion', definition: { id: 'ex', name: 'Exhaustion', valued: true }, value: 2 };
    const plan = {
      button: { id: 'long', name: 'Long rest', rules: [] },
      rules: [
        { index: 0, ref: 'always:0', rule: { target: { kind: 'resource', key: 'hp' }, does: 'full' }, target: hp },
        { index: 1, ref: 'always:1', rule: { target: { kind: 'resource', key: 'hp' }, does: 'spend', from: { kind: 'resource', key: 'hd' }, each: '1d8' }, target: hp, spend: { label: 'Hit Dice', max: 3, each: '1d8' } },
        { index: 2, ref: 'always:2', rule: { target: { kind: 'resource', key: 'hp' }, does: 'spend', from: { kind: 'resource', key: 'sp' }, each: '1' }, target: hp, spend: { label: 'Spirit', max: 3, each: '1' } },
        { index: 3, ref: 'always:3', rule: { target: { kind: 'condition', id: 'ex' }, does: 'step', by: -1 }, target: exhaustion },
      ],
      skipped: [],
    } as unknown as RestPlan;
    expect(restRulesText(plan, { picks: [], spends: new Map([['always:1', 2], ['always:2', 0]]) })).toEqual(['HP to full', '2 Hit Dice', 'Exhaustion −1']);
  });
});
