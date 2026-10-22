/**
 * Small English helpers for the grammar's modifiers: articles, plurals, agreement and casing.
 * They work on phrases ("a rusted iron key", "the halls of Ysmar"): agreement looks at the head
 * noun, the last word before an "of".
 */

/** Words read with a consonant sound although they start with a vowel letter. */
const CONSONANT_SOUND = /^(uni|use|usu|ura|ure|uri|uro|eu|ewe|one\b|once|ouija)/i;
/** Words read with a vowel sound although they start with a consonant letter. */
const VOWEL_SOUND = /^(hour|honest|honou?r|heir)/i;

export function article(phrase: string): string {
  const word = phrase.trimStart();
  if (word === '') return phrase;
  return `${startsWithVowelSound(word) ? 'an' : 'a'} ${word}`;
}

export function startsWithVowelSound(word: string): boolean {
  if (VOWEL_SOUND.test(word)) return true;
  if (CONSONANT_SOUND.test(word)) return false;
  if (/^[0-9]/.test(word)) return /^(8|11|18)/.test(word);
  return /^[aeiou]/i.test(word);
}

const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
  man: 'men',
  woman: 'women',
  mouse: 'mice',
  louse: 'lice',
  child: 'children',
  foot: 'feet',
  tooth: 'teeth',
  goose: 'geese',
  ox: 'oxen',
  person: 'people',
  die: 'dice',
  staff: 'staves',
  dwarf: 'dwarves',
};

/** Nouns whose plural is the noun itself. */
const UNCHANGED = new Set(['fish', 'sheep', 'deer', 'folk', 'swine', 'kin', 'vermin', 'undead', 'dead', 'moss', 'mould']);

const F_TO_VES = new Set(['wolf', 'thief', 'knife', 'leaf', 'elf', 'shelf', 'loaf', 'half', 'calf', 'wife', 'life', 'sheaf']);

/** Singular words that end in s. */
const SINGULAR_IN_S = new Set(['chaos', 'canvas', 'lens', 'gas', 'series', 'species', 'mantis', 'ibis', 'iris', 'atlas', 'bias']);

/** Plurals that do not end in s. */
const PLURAL_WORDS = new Set(['men', 'women', 'mice', 'lice', 'children', 'feet', 'teeth', 'geese', 'oxen', 'people', 'folk', 'dice', 'vermin', 'kin', 'swine', 'dead', 'undead', 'staves']);

function pluralWord(word: string): string {
  const hyphen = word.lastIndexOf('-');
  if (hyphen > 0) return word.slice(0, hyphen + 1) + pluralWord(word.slice(hyphen + 1));
  const lower = word.toLowerCase();
  const irregular = IRREGULAR_PLURALS[lower];
  if (irregular) return matchCase(word, irregular);
  if (lower.endsWith('man') && lower.length > 4) return `${word.slice(0, -3)}men`;
  if (UNCHANGED.has(lower)) return word;
  if (F_TO_VES.has(lower)) return `${word.replace(/fe?$/i, '')}ves`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

function matchCase(model: string, word: string): string {
  return /^[A-Z]/.test(model) ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** Splits a phrase into what comes before its head noun, the head noun, and what follows. */
function headOf(phrase: string): [string, string, string] {
  const ofAt = phrase.search(/ (of|from|with|within|in|into|on|by|devouring|crowned) /);
  const head = ofAt < 0 ? phrase : phrase.slice(0, ofAt);
  const rest = ofAt < 0 ? '' : phrase.slice(ofAt);
  const space = head.lastIndexOf(' ');
  return [head.slice(0, space + 1), head.slice(space + 1), rest];
}

export function plural(phrase: string): string {
  const [before, head, rest] = headOf(phrase);
  return `${before}${pluralWord(head)}${rest}`;
}

export function isPlural(phrase: string): boolean {
  const head = (headOf(phrase)[1].toLowerCase().split('-').pop() ?? '').replace(/[^a-z]/g, '');
  if (head.endsWith('men')) return true;
  if (PLURAL_WORDS.has(head)) return true;
  if (SINGULAR_IN_S.has(head)) return false;
  return /[^su]s$/.test(head) && !/(ss|us|is|ous)$/.test(head);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const SMALL_WORDS = new Set(['of', 'the', 'a', 'an', 'and', 'in', 'on', 'under', 'beneath', 'below', 'at', 'to', 'by']);

/** Title case: every word capitalized except small words after the first. */
export function capitalizeAll(text: string): string {
  return text
    .split(' ')
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : capitalize(word)))
    .join(' ');
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "two", "three"; numbers past ten stay digits. */
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/**
 * Tidies a generated passage: single spaces, no space before punctuation, every sentence
 * starting with a capital letter.
 */
export function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:!?])/g, '$1')
    .replace(/,([.;:!?])/g, '$1')
    .replace(/\.\./g, '.')
    .trim()
    .replace(/(^|[.!?] )([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}
