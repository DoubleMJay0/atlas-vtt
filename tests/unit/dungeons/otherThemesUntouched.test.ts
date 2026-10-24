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
  '1b33ejwqy12',
  'w1h7v7faxr',
  '18me0darzgv',
  'aqt5sy4jfa',
  '1e81ypbgajc',
  '7hrdmzeqer',
  '2cbh79k91mp',
  '29efk7o3qpk',
  '1mjkq6cjkzt',
  '45ifhgko3k',
  'lgzkizbl0d',
  'dspz2enpby',
  'sg9svi1urc',
  '173aemepz9d',
  'ug1drc58lv',
  '18nz0vrftt9',
  '9xcqp9mngp',
  '1g70xxwccye',
  '31yxqmg1qn',
  'x3webby8lp',
  '3pxw9ekrok',
  'gfiq3o51co',
  '253ikndhf76',
  'vaktosdpma',
  'e3qi6vcq7i',
  '1z0mqhg6pun',
  '2der7lg6tax',
  'qnt8ucm9x7',
  'toepd4vvi4',
  '211tt4nagr0',
  'uf2v1y4qdr',
  '7p25mgctvb',
  '10s9420a2pn',
  '29gasuyvjgr',
  '2di86zyrxc7',
  'in4t9386h8',
  'x7aefldpdb',
  '2x9pprqc8r',
  'w07s85i4fk',
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
