import { describe, expect, it } from 'vitest';
import { parseLogEntry } from '../../../../src/app/online/protocol/index.ts';
import { isOpen, readSavedLog, viewOf, type GmLogEntry } from '../../../../src/app/online/gm/log/logEntries.ts';

const MIRA = 'm'.repeat(20);
const TOM = 't'.repeat(20);

const REST: GmLogEntry = {
  id: 'e'.repeat(24), at: 1_000, who: 'gm', name: 'GM', kind: 'rest', character: 'Brannoch', button: 'Long rest',
  changes: [{ label: 'Hit Points', from: 4, to: 18, roll: '2d8+2 = 14' }], skipped: ['Exhaustion'], restPlayers: [MIRA],
};

describe('a rest in the log', () => {
  it('reads whole to the GM and the character\'s player, and as its title to everyone else', () => {
    const { restPlayers: _players, ...shared } = REST;
    expect(viewOf(REST, 'gm')).toEqual(shared);
    expect(viewOf(REST, MIRA)).toEqual(shared);
    const { changes: _changes, skipped: _skipped, ...title } = shared;
    expect(viewOf(REST, TOM)).toEqual(title);
    expect(parseLogEntry(viewOf(REST, TOM))).toEqual(title);
    // Each is sent their own view, never one for all.
    expect(isOpen(REST)).toBe(false);
  });

  it('is its title to every player where nobody plays its character any more', () => {
    const { restPlayers: _players, ...orphan } = REST;
    expect(viewOf(orphan, MIRA)).not.toHaveProperty('changes');
  });

  it('keeps who sees what it changed with the saved log', () => {
    const { entries } = readSavedLog({ entries: [JSON.parse(JSON.stringify(REST)), { ...REST, id: 'f'.repeat(24), restPlayers: ['not a player', 7] }], present: [] });
    expect(entries[0]?.restPlayers).toEqual([MIRA]);
    expect(entries[1]).not.toHaveProperty('restPlayers');
  });
});
