/**
 * Invented names (bosses, artefacts, founders) from a second-order Markov chain over letters of our
 * own seed names. A name has three or four syllables; one in four is two shorter parts joined by a
 * hyphen ("Kaul-Vessith"). Names that are hard to say, too long, copied or rude are thrown away.
 */

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import { NAME_SEEDS } from './nameSeeds';

const START = '^';
const END = '$';
const VOWELS = /[aeiouy]+/g;

/** Words a generated name must never contain. */
const BLOCKED = [
  'fuck', 'shit', 'cunt', 'nig', 'fag', 'rape', 'slut', 'whore', 'cock', 'dick', 'piss', 'anus', 'kike',
  'spic', 'nazi', 'hitler', 'satan', 'jesus', 'allah', 'kkk', 'cum', 'tit', 'porn', 'sex', 'jew', 'gay',
];

type Chain = ReadonlyMap<string, readonly string[]>;

function buildChain(seeds: readonly string[]): Chain {
  const chain = new Map<string, string[]>();
  for (const seed of seeds) {
    const letters = `${START}${START}${seed.toLowerCase()}${END}`;
    for (let i = 2; i < letters.length; i++) {
      const key = letters.slice(i - 2, i);
      const next = chain.get(key) ?? [];
      next.push(letters[i] as string);
      chain.set(key, next);
    }
  }
  return chain;
}

const CHAIN = buildChain(NAME_SEEDS);
const SEEDS = new Set(NAME_SEEDS.map((name) => name.toLowerCase()));

function walk(rng: Rng, maxLength: number): string {
  let state = `${START}${START}`;
  let out = '';
  while (out.length <= maxLength) {
    const options = CHAIN.get(state);
    if (!options) break;
    const next = pick(rng, options);
    if (next === END) return out;
    out += next;
    state = state.slice(1) + next;
  }
  return '';
}

export function syllables(word: string): number {
  return word.toLowerCase().match(VOWELS)?.length ?? 0;
}

/** Whether a generated word is fit to print: sayable, of the right length, new and inoffensive. */
export function acceptableName(word: string, minSyllables: number, maxSyllables: number, maxLength: number): boolean {
  const lower = word.toLowerCase();
  if (lower.length < 4 || lower.length > maxLength) return false;
  const count = syllables(lower);
  if (count < minSyllables || count > maxSyllables) return false;
  if (/[^aeiouy]{4}/.test(lower) || /[aeiou]{3}/.test(lower) || /(.)\1\1/.test(lower)) return false;
  if (/^[^aeiouy]{3}/.test(lower) || /[^aeiouyhnrslmt]{2}$/.test(lower)) return false;
  if (SEEDS.has(lower)) return false;
  return !BLOCKED.some((bad) => lower.includes(bad));
}

function capitalized(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function part(rng: Rng, minSyllables: number, maxSyllables: number, maxLength: number): string | null {
  for (let attempt = 0; attempt < 60; attempt++) {
    const word = walk(rng, maxLength);
    if (acceptableName(word, minSyllables, maxSyllables, maxLength)) return capitalized(word);
  }
  return null;
}

/** A new name; falls back to a seed name in the rare case the chain keeps failing the filter. */
export function generateName(rng: Rng): string {
  if (chance(rng, 0.25)) {
    const first = part(rng, 2, 2, 6);
    const second = part(rng, 2, 3, 7);
    if (first && second) return `${first}-${second}`;
  }
  return part(rng, 3, 4, 10) ?? pick(rng, NAME_SEEDS);
}
