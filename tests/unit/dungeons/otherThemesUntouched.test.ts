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
 * their grounds were drawn (2026-10-25: every Fortress hash unchanged each time); never re-recorded
 * for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  '3sssiujyfg',
  'w1h7v7faxr',
  'q2gxhvlh4j',
  'aqt5sy4jfa',
  '1xnqby47bwq',
  '7hrdmzeqer',
  '15978shvoa6',
  '29efk7o3qpk',
  '19z69ht9s6y',
  '45ifhgko3k',
  '1h5cmt35w84',
  'dspz2enpby',
  'i0q496b99z',
  '173aemepz9d',
  'vztfx2ege',
  '18nz0vrftt9',
  'l3o5aqsra6',
  '1g70xxwccye',
  'qwawes43tg',
  'x3webby8lp',
  '1tptgzvo04a',
  'gfiq3o51co',
  'e1ek97rte6',
  'vaktosdpma',
  '1q28noi8n9b',
  '1z0mqhg6pun',
  '177fy93gipc',
  'qnt8ucm9x7',
  'e4bzhe13pl',
  '211tt4nagr0',
  'whcb8mk0v5',
  '7p25mgctvb',
  '1biafo74uet',
  '29gasuyvjgr',
  'c046p3qmzc',
  'in4t9386h8',
  '8k16cmkz7z',
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
