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

/** Recorded with `VITE_DUNGEON_HASHES=print`; never re-recorded for a change of the Cavern alone. */
const HASHES: readonly string[] = [
  'tokwrbg7bs',
  '1ggkrw6m7zv',
  '1m7x7o2m6m4',
  '1ko0s3cug9c',
  '2gewehj5srx',
  '1dgmfwfjbx1',
  '2g8u548hpc9',
  '1g45m2bwsaq',
  'ls7v4pkao9',
  'kyl58unx73',
  '26h9qv1vop0',
  '1e5eqovwugz',
  'kvicrmbwmd',
  '11plvixdk6m',
  'nesa8yfksb',
  '2fufcs5qeqv',
  '1jyqfxq93zk',
  '24pn6myblg8',
  'olnbb93txi',
  'jrox418dw1',
  '1vwhar5wtci',
  'twa5ugt2wh',
  'jasu04utba',
  '6yec8v1pl3',
  '2ge2ozk62p',
  '1vv0qpnmvuv',
  '275koetdkpd',
  '2b3rmzev5xh',
  '27p55z5b1f9',
  '5b2cwb3lnj',
  '20lbyfm3z6s',
  '1m8y9ski3da',
  '2bai179ofyl',
  '1zv2mlv446u',
  'sg8dpo5sh2',
  'wzkstqe516',
  '2dyjj3xkol0',
  'agroevgloi',
  'c8er7lol5k',
  '1gc7w53zxx1',
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
