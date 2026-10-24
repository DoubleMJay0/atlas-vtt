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
 * and when their windows took a manor's rules (2026-10-25: every Fortress hash unchanged both
 * times); never re-recorded for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  'vh3xsj8qul',
  'w1h7v7faxr',
  '1k8cse9zy69',
  'aqt5sy4jfa',
  '11jiobxs4rz',
  '7hrdmzeqer',
  '1doojgkchst',
  '29efk7o3qpk',
  '21rkfsvgaod',
  '45ifhgko3k',
  'syyemc84ie',
  'dspz2enpby',
  '25p58amuwpy',
  '173aemepz9d',
  '17u1v9z2ro2',
  '18nz0vrftt9',
  'ror6wpmyfj',
  '1g70xxwccye',
  'a39gtpeuwq',
  'x3webby8lp',
  'jpq5qxfx3p',
  'gfiq3o51co',
  '1ple4fl8sms',
  'vaktosdpma',
  '28ggxn3hsb6',
  '1z0mqhg6pun',
  'vodghxtw2',
  'qnt8ucm9x7',
  '204p3hylxds',
  '211tt4nagr0',
  '1nrq13fzsd2',
  '7p25mgctvb',
  'hg3bdl99of',
  '29gasuyvjgr',
  'p9nxlzbthi',
  'in4t9386h8',
  '1geft3u6tl4',
  '2x9pprqc8r',
  'q3plefmfiz',
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
