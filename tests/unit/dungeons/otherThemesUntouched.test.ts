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
 * fireplaces and daises; no furniture), with the pieces drawn then; never re-recorded for a change
 * of the Cavern alone.
 */
const HASHES: readonly string[] = [
  '2egkihw8orp',
  '6hqv662nr5',
  '1bew5eeqcuo',
  '236e33tzuu3',
  '1wslmz9ski1',
  'mslnr5c8d9',
  '90woi2q7pj',
  '1r4baav2ngw',
  'rqgvtndwrb',
  'zqsvomf4dj',
  'ai7zeanv26',
  '1nbo099tyv5',
  '1a7wmtm3pcm',
  '1ci1vodnb15',
  '1ys6i0tm0l1',
  '20gzligzalp',
  'a5li3vel7u',
  '19ve0ejevih',
  'ps98ubgfbn',
  'etr6p3jeh6',
  '110f9o10lq5',
  '2ugra8laoc',
  '1w4fbzzvo17',
  'mc9ud4z3nv',
  '1n1m38qx5dt',
  '1qubqr9spox',
  '1g3x5myrcvc',
  'gu8oc4elmx',
  'lue31z4gb',
  '15aovkrxg6n',
  '1prpxykp06j',
  's0t97xtac',
  'iubi6safal',
  '1cgzjnvv0xn',
  'd5vyhekh8l',
  'i1x8svj5je',
  '1y4jkczjs4k',
  '1xgpl6zmsow',
  '1asz6p3ylau',
  'tr87lskweb',
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
