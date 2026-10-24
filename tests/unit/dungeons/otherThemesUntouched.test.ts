import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import type { DungeonRequest } from '../../../src/app/dungeons/model';
import { canonicalJson, hashText } from '../../../src/app/utils/hashing';

const TAG_SETS: readonly string[][] = [[], ['large', 'wet'], ['small', 'secret'], ['crumbling', 'overgrown']];

/** Fortress and Haunted Mansion dungeons as the Cavern's layout must leave them. */
const REQUESTS: readonly DungeonRequest[] = Array.from({ length: 40 }, (_, i) => {
  const k = i + 1;
  return { seed: k * 104_729, theme: k % 2 === 0 ? 'fortress' : 'mansion', tags: TAG_SETS[k % TAG_SETS.length] ?? [], floors: 1 + (k % 3) };
});

/**
 * Recorded with `VITE_DUNGEON_HASHES=print` when the dungeons took their structure alone (statues,
 * busts, fireplaces and daises; no furniture) with every kept piece drawn; never re-recorded for a
 * change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  'hef90mfqlo',
  '2g7q1l41fn2',
  '6b6119klo9',
  'occankg166',
  '1bw3k0y5ils',
  '1vqsprxlzq',
  '13izp695hqd',
  'fcgq63seyk',
  'eugl915abh',
  's4zooqha6n',
  '1jqlijjr9kw',
  'ct0e5xks37',
  'pxgr0yf45j',
  'n5pypywvf7',
  '4jz0burnr6',
  '22q5r92trn9',
  '1szb4yjko4v',
  '1q6sosxti5x',
  '1uqx868fphu',
  '1e43biijo9l',
  '2bmh3ig1fha',
  'mmqe1wvqp7',
  'p05trb5uan',
  'wlr5fh104m',
  '1gyoj69ld16',
  '230dgt0fbp5',
  'tgwa86ve8',
  'brt24babsy',
  '1uzg5dvfdrq',
  '1cr7ofcrxo6',
  'j86k7mq5wk',
  '127gmj44xg4',
  '1be7q45fzbi',
  '2eeanm9osbc',
  '2g5jmq1vb28',
  'hisl6e28h0',
  '1yttge1qk8p',
  '17ttghinzzi',
  '2d1k8vford0',
  'z56bu0kugf',
];

describe('dungeons of the other themes', () => {
  it('are the same as before the Cavern had a layout of its own', () => {
    const hashes = REQUESTS.map((request) => hashText(canonicalJson(generateDungeon(request))));
    if (import.meta.env.VITE_DUNGEON_HASHES === 'print') {
      console.log(JSON.stringify(hashes));
      return;
    }
    expect(hashes).toEqual(HASHES);
  }, 120_000);
});
