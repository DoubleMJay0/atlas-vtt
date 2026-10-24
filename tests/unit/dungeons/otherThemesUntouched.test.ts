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
 * busts, fireplaces and daises; no furniture) with every kept piece drawn, and the Mansions again
 * when they took no cover beyond their rooms' own, and the Fortresses again when their passages
 * grew wide and their round rooms became towers; never re-recorded for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  'p9mqnnntzw',
  'w1h7v7faxr',
  '1ej54lf3l16',
  'aqt5sy4jfa',
  '1xkxdb7d93q',
  '7hrdmzeqer',
  '5g7wf6brx9',
  '29efk7o3qpk',
  'aw18mnbgaf',
  '45ifhgko3k',
  '1cap3h4vlcf',
  'dspz2enpby',
  'igtag215th',
  '173aemepz9d',
  'ddz9wrjc7h',
  '18nz0vrftt9',
  '2ak2dhfuqud',
  '1g70xxwccye',
  '43xls6u0uc',
  'x3webby8lp',
  '1c259g1407t',
  'gfiq3o51co',
  'oxr5cxvmei',
  'vaktosdpma',
  '1d84w46hm5p',
  '1z0mqhg6pun',
  '1cg64ifz9x7',
  'qnt8ucm9x7',
  '20ib3l5k3ad',
  '211tt4nagr0',
  'avqbg4j3m5',
  '7p25mgctvb',
  '27p4bbil667',
  '29gasuyvjgr',
  '17hm53u6nry',
  'in4t9386h8',
  '10cemp8nhu2',
  '2x9pprqc8r',
  '27jmu0nun0m',
  '20iw87kiu5p',
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
