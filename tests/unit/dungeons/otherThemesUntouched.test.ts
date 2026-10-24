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
 * Recorded with `VITE_DUNGEON_HASHES=print` on the theme-core branch alone (feature/dungeon-themes at its
 * merge); never re-recorded for a change of the Cavern alone.
 */
const HASHES: readonly string[] = [
  '113tyhju712',
  '1qjmognggta',
  '19tcod7re3q',
  'g8e1vvaexr',
  '1k1ij7qyb8d',
  '1iqtuopnx4k',
  'z07y1lvqr6',
  '19ns9puid6q',
  '1g2a5wu1tzk',
  '27xvndg4w86',
  '16gx2uxl1ht',
  'h41csqujqm',
  '1ww7rn30c97',
  '1clki1oz0nc',
  '1lx4pnx9ziu',
  '9l1qa4qpp3',
  'e4kx607fpy',
  '2ei9z9dirgw',
  '1nnq8hn5rrb',
  '2dbeb5xraz0',
  '1bpspmenmic',
  '1yj0k0i8nu0',
  '9t5l7xmlr9',
  '2du863504nh',
  'u03cm6g6ch',
  'y5ztkvg7m0',
  '1i0ak5d63qs',
  '52sjtnhfbd',
  '8to2c1svwx',
  '1mrqd5iop3m',
  'tg7vs0r7a',
  '19tk39wvqe',
  '1khbvuapuf3',
  '1via4d1la5c',
  '1l5ebbob0x2',
  '28mjqx5ddz8',
  '1i9h30z29vj',
  '2aqep1n0i1p',
  '24dff0j20ys',
  '1v12luhsoxp',
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
