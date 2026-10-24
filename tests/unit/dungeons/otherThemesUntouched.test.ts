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
 * every Fortress hash unchanged); never re-recorded for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  '18l3e34lhc',
  'w1h7v7faxr',
  '1oiq3pxqh0n',
  'aqt5sy4jfa',
  '6t5ypr5wza',
  '7hrdmzeqer',
  '1qlzcv5utqi',
  '29efk7o3qpk',
  '1b3q8nk9dqj',
  '45ifhgko3k',
  '6fq6sb7m0d',
  'dspz2enpby',
  '1xsib9dn6jj',
  '173aemepz9d',
  '1mf19wdyaw6',
  '18nz0vrftt9',
  'gyqaomlyw',
  '1g70xxwccye',
  '5jli9ffyeb',
  'x3webby8lp',
  'ia7pz64a5k',
  'gfiq3o51co',
  '1zsoc2nk8jk',
  'vaktosdpma',
  '156nfhh6mju',
  '1z0mqhg6pun',
  '1omncnaicg3',
  'qnt8ucm9x7',
  'js62dj6tpz',
  '211tt4nagr0',
  '2cekeyyzfvq',
  '7p25mgctvb',
  '2dxrqbcyzh1',
  '29gasuyvjgr',
  'mizwmxeg64',
  'in4t9386h8',
  '1mad8537zlb',
  '2x9pprqc8r',
  '1lcsp5r39wc',
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
