import { describe, expect, it } from 'vitest';
import { parsePlayerMessage, type GmMessage } from '../../../../src/app/online/protocol/index.ts';
import { CoveredPages } from '../../../../src/app/online/gm/coveredPages.ts';

const ANA = 'anaanaanaanaanaanaan';
const BEN = 'benbenbenbenbenbenbe';
const MARKS: GmMessage = { t: 'marks', scene: 's', lasers: [], measures: [] };
const DRAG: GmMessage = { t: 'live', scene: 's', at: 1, tokens: [{ id: 'a'.repeat(24), x: 1, y: 2 }] };
const DROP: GmMessage = { t: 'live', scene: 's', at: 2, tokens: [{ id: 'a'.repeat(24), x: 1, y: 2, end: true }] };

function pages(batches = true): { readonly covers: CoveredPages; readonly sent: { body: GmMessage; to: string }[]; readonly uncovered: string[] } {
  const sent: { body: GmMessage; to: string }[] = [];
  const uncovered: string[] = [];
  const covers = new CoveredPages({ sendLive: (body, _key, to = '*') => void sent.push({ body, to }), batches: () => batches, connected: () => [ANA, BEN], uncovered: (player) => void uncovered.push(player) });
  return { covers, sent, uncovered };
}

describe('pages whose book covers their map', () => {
  it('reads the cover message, and the GM\'s parser reads it too', () => {
    expect(parsePlayerMessage({ t: 'book-cover', covered: true })).toEqual({ t: 'book-cover', covered: true });
    expect(parsePlayerMessage({ t: 'book-cover', covered: 'yes' })).toBeNull();
  });

  it('sends the table\'s activity to all while no page is covered', () => {
    const { covers, sent } = pages();
    covers.sendLive(MARKS, 'marks');
    expect(sent).toEqual([{ body: MARKS, to: '*' }]);
  });

  it('leaves a covered page out of marks and drags under way, never out of a drag\'s end, and tells when it is uncovered', () => {
    const { covers, sent, uncovered } = pages();
    expect(covers.receive(ANA, { t: 'book-cover', covered: true })).toBe(true);
    covers.sendLive(MARKS, 'marks');
    covers.sendLive(DRAG, 's');
    covers.sendLive(DROP, 's\n1');
    expect(sent).toEqual([{ body: MARKS, to: BEN }, { body: DRAG, to: BEN }, { body: DROP, to: '*' }]);
    covers.receive(ANA, { t: 'book-cover', covered: false });
    expect(uncovered).toEqual([ANA]);
    covers.receive(ANA, { t: 'book-cover', covered: false });
    expect(uncovered).toEqual([ANA]);
  });

  it('sends to all where the relay takes no batches, and forgets a page that left', () => {
    const unbatched = pages(false);
    unbatched.covers.receive(ANA, { t: 'book-cover', covered: true });
    unbatched.covers.sendLive(MARKS, 'marks');
    expect(unbatched.sent).toEqual([{ body: MARKS, to: '*' }]);
    const { covers, sent } = pages();
    covers.receive(ANA, { t: 'book-cover', covered: true });
    covers.playerLeft(ANA);
    covers.sendLive(MARKS, 'marks');
    expect(sent).toEqual([{ body: MARKS, to: '*' }]);
  });

  it('is not a message of anyone else', () => {
    expect(pages().covers.receive(ANA, { t: 'book-parts' })).toBe(false);
  });
});
