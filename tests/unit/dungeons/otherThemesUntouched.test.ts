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
 * grew wide and their round rooms became towers, and the Mansions again when they became houses
 * and when their windows took a manor's rules, and when their chimney stacks became few, and when
 * their grounds were drawn (2026-10-25), and when their ways were laid out on the door's axis and
 * round their turns (2026-10-26) (every Fortress hash unchanged each time); never re-recorded
 * for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  '2f9y1l63fd3',
  'w1h7v7faxr',
  '1k2pcqt0t87',
  'aqt5sy4jfa',
  '5dfou3wtib',
  '7hrdmzeqer',
  'aqh4m8aavm',
  '29efk7o3qpk',
  'wo0nynryoe',
  '45ifhgko3k',
  '22ue1hpiykj',
  'dspz2enpby',
  'nvarpd1dm6',
  '173aemepz9d',
  'vztfx2ege',
  '18nz0vrftt9',
  'bcoi3bocvz',
  '1g70xxwccye',
  '1ic00r62qva',
  'x3webby8lp',
  '22x5564d9ca',
  'gfiq3o51co',
  '1dzsj561zs1',
  'vaktosdpma',
  '2arr6uup4nk',
  '1z0mqhg6pun',
  'gblsd5b5jg',
  'qnt8ucm9x7',
  '28fyeavrvzr',
  '211tt4nagr0',
  '2f2p43mzu7u',
  '7p25mgctvb',
  '2bc6nvamxyz',
  '29gasuyvjgr',
  'vszu860w1f',
  'in4t9386h8',
  '168jilndqh0',
  '2x9pprqc8r',
  'aasa7adl1q',
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
