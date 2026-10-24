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
 * grew wide and their round rooms became towers, and the Mansions again when they became houses (2026-10-25:
 * every Fortress hash unchanged), and the Mansions again when their grounds were drawn (Fortresses unchanged); never re-recorded for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  '1x5uqkpgi82',
  'w1h7v7faxr',
  '19gqfcux33o',
  'aqt5sy4jfa',
  '17bdg1gmc14',
  '7hrdmzeqer',
  '1iap92mumqh',
  '29efk7o3qpk',
  '2353l6eb4qt',
  '45ifhgko3k',
  '1at3vjt6vsf',
  'dspz2enpby',
  'a618619wto',
  '173aemepz9d',
  '1z5uiu249d3',
  '18nz0vrftt9',
  's9t73b2mtw',
  '1g70xxwccye',
  '18i268ye2y5',
  'x3webby8lp',
  '2a4pe9mc9xv',
  'gfiq3o51co',
  'eqh2r7poac',
  'vaktosdpma',
  'yre1r3d6ka',
  '1z0mqhg6pun',
  '28o9w0u0htl',
  'qnt8ucm9x7',
  '1nbb75fqcu2',
  '211tt4nagr0',
  '2qeor3q20v',
  '7p25mgctvb',
  'n1m72jy9o',
  '29gasuyvjgr',
  '18np2oesjhk',
  'in4t9386h8',
  'mazrt4nclw',
  '2x9pprqc8r',
  '13jymos6v5s',
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
