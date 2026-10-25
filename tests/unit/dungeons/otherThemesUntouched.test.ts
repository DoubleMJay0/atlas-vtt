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
 * and when their windows took a manor's rules, and when their chimney stacks became few (2026-10-25:
 * every Fortress hash unchanged each time); never re-recorded for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  '3y700m56nt',
  'w1h7v7faxr',
  '25pugnhtxea',
  'aqt5sy4jfa',
  '1agqr78mph5',
  '7hrdmzeqer',
  'ux7a6wb852',
  '29efk7o3qpk',
  '2bc7nljl7y3',
  '45ifhgko3k',
  'von8wvdqft',
  'dspz2enpby',
  '17xjdhy65uu',
  '173aemepz9d',
  '263pz4s2wsv',
  '18nz0vrftt9',
  'dxqh1h7usa',
  '1g70xxwccye',
  '1ehoxsjt8v7',
  'x3webby8lp',
  'sqpcotd9xm',
  'gfiq3o51co',
  'rtaoh1upt4',
  'vaktosdpma',
  'uzki8nxym2',
  '1z0mqhg6pun',
  'cseyvx8nhh',
  'qnt8ucm9x7',
  '1jyrf4l6yec',
  '211tt4nagr0',
  '18q52xhs6n',
  '7p25mgctvb',
  '1qf1h69rh4u',
  '29gasuyvjgr',
  'oyqvo9wpbv',
  'in4t9386h8',
  'vkjsgvcqvp',
  '2x9pprqc8r',
  '1uh4qvzym7w',
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
