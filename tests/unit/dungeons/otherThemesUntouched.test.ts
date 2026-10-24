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
 * when they took no cover beyond their rooms' own; never re-recorded for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  'p9mqnnntzw',
  '2g7q1l41fn2',
  '1ej54lf3l16',
  'occankg166',
  '1xkxdb7d93q',
  '1vqsprxlzq',
  '5g7wf6brx9',
  'fcgq63seyk',
  'aw18mnbgaf',
  's4zooqha6n',
  '1cap3h4vlcf',
  'ct0e5xks37',
  'igtag215th',
  'n5pypywvf7',
  'ddz9wrjc7h',
  '22q5r92trn9',
  '2ak2dhfuqud',
  '1q6sosxti5x',
  '43xls6u0uc',
  '1e43biijo9l',
  '1c259g1407t',
  'mmqe1wvqp7',
  'oxr5cxvmei',
  'wlr5fh104m',
  '1d84w46hm5p',
  '230dgt0fbp5',
  '1cg64ifz9x7',
  'brt24babsy',
  '20ib3l5k3ad',
  '1cr7ofcrxo6',
  'avqbg4j3m5',
  '127gmj44xg4',
  '27p4bbil667',
  '2eeanm9osbc',
  '17hm53u6nry',
  'hisl6e28h0',
  '10cemp8nhu2',
  '17ttghinzzi',
  '27jmu0nun0m',
  'z56bu0kugf',
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
