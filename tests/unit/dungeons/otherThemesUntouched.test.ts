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
 * Recorded with `VITE_DUNGEON_HASHES=print` on the theme branch alone (feature/dungeon-themes at 5768f037a,
 * its floors going up) when the Cavern was merged with it; never re-recorded for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  '1e1fpfx6y9o',
  '7khcbi9ano',
  '19tcod7re3q',
  'dfpjany336',
  '15vzam1siub',
  '1iqtuopnx4k',
  '2arkpgzag5g',
  'r90luz14fs',
  '1g2a5wu1tzk',
  '4jcxf3vn29',
  'do94ma6vh9',
  'h41csqujqm',
  '1e8utzqei85',
  'i51973gkr5',
  '1lx4pnx9ziu',
  '14gy32e2k1y',
  '1raio1o1shv',
  '1m6yngkn30n',
  '21v3h3a7ne8',
  'gpvb2chu6y',
  '1bpspmenmic',
  '2cnb09crbdp',
  '1ynya6zvacy',
  '2du863504nh',
  '2ehkb4qru40',
  '8eneydhwmo',
  '1i0ak5d63qs',
  'wbpnh0xzlw',
  'hn46hqyrpr',
  'kcb4rkn1iq',
  '1q31by80tet',
  '5wkngfj1vi',
  '1khbvuapuf3',
  '1x750x99etf',
  'cmp3z3p27s',
  '28mjqx5ddz8',
  'ccpwfmfsgz',
  '1443q4og977',
  '24dff0j20ys',
  'kzi37un7rp',
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
