import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseGmMessage, type BookStatblock } from '../../../../src/app/online/protocol/index.ts';
import { BOOK_POLL_MS, REFUSAL_BOOK_MS } from '../../../../src/app/online/gm/book/BookShare.ts';
import { BookShelf } from '../../../../src/app/online/gm/book/BookShelf.ts';
import { setStatblockGate } from '../../../../src/app/online/gm/book/statblockGate.ts';
import type { StatblockTemplate } from '../../../../src/app/statblocks/model/templateTypes';
import { FakeSocket, workspace } from './fakeTable.ts';
import { ANA, BEN, CAL, cave, delivered, keptBooks, ofType, openTable, type Delivered } from './bookTableHarness.ts';
import { advanceSettled as advance } from './settled.ts';
import { propertiesOf, StatblockNotes, templateOf } from './statblockNotes.ts';

vi.mock('obsidian', () => ({ Notice: class {}, normalizePath: (path: string) => path, requestUrl: () => Promise.resolve({ status: 201, json: null }), PluginSettingTab: class {}, Setting: class {} }));
// The GM's marks draw with PIXI over Atlas's canvas, which a table of books has no use for.
vi.mock('../../../../src/app/online/gm/gmMarks.ts', () => ({
  GmMarks: class {
    source(): null {
      return null;
    }
    showPlayers(): void {}
    showPlayerCursors(): void {}
    dispose(): void {}
  },
}));
vi.mock('../../../../src/app/online/gm/atlasLighting.ts', async (original) => ({ ...(await original<typeof import('../../../../src/app/online/gm/atlasLighting.ts')>()), accentColour: () => '#112233' }));

const PLAYERS = [{ id: ANA, name: 'Ana' }, { id: BEN, name: 'Ben' }, { id: CAL, name: 'Cal' }];
const PATH = 'Characters/Brannoch.md';
const TEMPLATE: StatblockTemplate = {
  ...templateOf(
    [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'slots', label: 'Spell slots', type: 'counters' },
      { key: 'charges', label: 'Charges', type: 'counters' },
    ],
    [{ id: 'slots001', type: 'counters', field: 'slots' }, { id: 'charge01', type: 'counters', field: 'charges' }],
  ),
  refills: [{ name: 'Short rest' }, { name: 'Long rest', includes: ['Short rest'] }, { name: 'Dawn' }],
};
const NOTE = `---
statblock: true
atlas-template: ${TEMPLATE.id}
name: Brannoch
slots:
  - name: Ki
    max: 2
    used: 2
    reset: Short rest
  - name: 1st level
    max: 3
    used: 1
    reset: Long rest
charges:
  - name: Rage
    max: 2
    used: 1
    reset: Long rest
  - name: Wand
    max: 7
    used: 4
    reset: Dawn
    regain: 1d6+1
---
Brannoch's own words.
`;

/** The statblocks a player was sent, as the page reads them. */
function statblocks(messages: readonly Delivered[], player: string): (BookStatblock | null)[] {
  return ofType(messages, 'book-statblock').filter(({ to }) => to === player).map(({ body }) => {
    const read = parseGmMessage(JSON.parse(JSON.stringify(body)));
    if (read?.t !== 'book-statblock') throw new Error('a statblock the page would not read');
    return read.statblock;
  });
}

const kinds = (messages: readonly Delivered[], player: string): string[] => ofType(messages, 'book', 'book-statblock').filter(({ to }) => to === player).map(({ body }) => String(body.t));

describe('a player taking a refill of their own character\'s sheet at a running table', () => {
  let notes: StatblockNotes;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('WebSocket', FakeSocket);
    FakeSocket.all = [];
    workspace.leaves = [];
    workspace.presented = null;
    notes = new StatblockNotes().install();
    notes.put(PATH, TEMPLATE, NOTE);
  });

  afterEach(() => {
    setStatblockGate(null);
    workspace.assets = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function table(shelf = new BookShelf()): Promise<Awaited<ReturnType<typeof openTable>>> {
    const opened = await openTable(shelf, PLAYERS);
    opened.tab.store.set(cave({ brannoch: { statblockPath: PATH } }));
    await advance(REFUSAL_BOOK_MS);
    return opened;
  }

  it('is offered the template\'s refills on the sheet it is sent', async () => {
    const { online, socket } = await table();
    expect(statblocks(delivered(socket), ANA).at(-1)?.refills).toEqual([
      { name: 'Short rest', includes: [] }, { name: 'Long rest', includes: ['Short rest'] }, { name: 'Dawn', includes: [] },
    ]);
    online.stop();
  });

  it('refills every counter of the sheet it names, in two fields at once, and answers with the statblock that follows', async () => {
    const { online, socket, from } = await table();
    const since = delivered(socket).length;
    from(ANA, { t: 'book-refill', refill: 'Long rest' });
    await advance(BOOK_POLL_MS);
    expect(notes.writes).toHaveLength(1);
    expect(notes.writes[0]?.patches.map((patch) => patch.path)).toEqual([['slots'], ['charges']]);
    const after = propertiesOf(notes.text(PATH));
    expect(after?.slots).toEqual([{ name: 'Ki', max: 2, used: 0, reset: 'Short rest' }, { name: '1st level', max: 3, used: 0, reset: 'Long rest' }]);
    expect(after?.charges).toEqual([{ name: 'Rage', max: 2, used: 0, reset: 'Long rest' }, { name: 'Wand', max: 7, used: 4, reset: 'Dawn', regain: '1d6+1' }]);
    expect(notes.text(PATH).endsWith('---\nBrannoch\'s own words.\n')).toBe(true);
    expect(kinds(delivered(socket).slice(since), ANA)).toEqual(['book-statblock']);
    online.stop();
  });

  it('refuses a refill whose formula no shared scene\'s dice can roll, writing nothing', async () => {
    const { online, socket, from } = await table();
    const since = delivered(socket).length;
    from(ANA, { t: 'book-refill', refill: 'Dawn' });
    await advance(BOOK_POLL_MS);
    expect(notes.writes).toEqual([]);
    expect(kinds(delivered(socket).slice(since), ANA)[0]).toBe('book');
    online.stop();
  });

  it('changes neither the shelf nor any note for an unknown refill, a player whose character has no statblock, or one without a character', async () => {
    const source = keptBooks();
    const shelf = new BookShelf(source);
    const { online, from } = await table(shelf);
    const books = source.dump();
    for (const [player, refill] of [[ANA, 'Session'], [ANA, 'long rest'], [BEN, 'Long rest'], [CAL, 'Long rest']] as const) {
      from(player, { t: 'book-refill', refill });
      await advance(REFUSAL_BOOK_MS);
    }
    expect(notes.writes).toEqual([]);
    expect(notes.text(PATH)).toBe(NOTE);
    expect(source.dump()).toBe(books);
    expect(source.writes).toBe(0);
    online.stop();
  });
});
