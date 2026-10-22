/**
 * A small Tracery-like text grammar of our own.
 *
 * - `#symbol#` expands one alternative of a symbol; `#symbol.a.capitalize#` applies modifiers
 *   (see `MODIFIERS`). Alternatives come from a shuffled deck per symbol, so none repeats before
 *   the deck runs out.
 * - `{a|b|c}` picks one inline; `{x}` keeps x half the time. Braces nest.
 * - `[name:text]` pushes `text` (expanded once) as the symbol `name` for the rest of the
 *   alternative it stands in; `[name:POP]` drops the newest push early.
 * - An alternative may start with a gate, `GATE?-text`: `0.3` keeps it with that probability,
 *   `WET` only while the flag is set, `!DRY` while it is not; `&` joins terms, `|` offers choices.
 * - A rules key `GATE?-symbol` overrides `symbol` while its gate holds (first one listed wins).
 * - An alternative may carry marks (props it names, water, rubble); `expand` returns the marks of
 *   every alternative that went into its text, so a note knows what it mentions by construction.
 */

import type { PropKind } from '../model';
import type { Rng } from '../rng';
import { shuffled } from '../rng';
import { article, capitalize, capitalizeAll, isPlural, plural } from './english';

export type Mark = PropKind | 'water' | 'rubble';

export type Alternative = string | { readonly t: string; readonly mark: readonly Mark[] };

export type GrammarRules = Readonly<Record<string, readonly Alternative[]>>;

export interface GrammarOptions {
  flags?: Iterable<string>;
  /** Symbols made by code rather than rules (generated names); fresh on every use. */
  externals?: Readonly<Record<string, () => string>>;
}

export interface Expansion {
  text: string;
  marks: Mark[];
}

interface Compiled {
  gate: string | null;
  text: string;
  marks: readonly Mark[];
}

interface Pushed {
  text: string;
  marks: readonly Mark[];
}

/** Deeper than any rule we write; reaching it means a symbol refers to itself. */
export const MAX_DEPTH = 32;

const GATE = /^([A-Za-z0-9_.!&|]+)\?-/;

const MODIFIERS: Readonly<Record<string, (text: string) => string>> = {
  a: article,
  s: plural,
  capitalize,
  capitalizeAll,
  is: (text) => `${text} ${isPlural(text) ? 'are' : 'is'}`,
  was: (text) => `${text} ${isPlural(text) ? 'were' : 'was'}`,
  has: (text) => `${text} ${isPlural(text) ? 'have' : 'has'}`,
  they: (text) => (isPlural(text) ? 'they' : 'it'),
  them: (text) => (isPlural(text) ? 'them' : 'it'),
  their: (text) => (isPlural(text) ? 'their' : 'its'),
  /** The phrase followed by the verb in agreement with it ("the halls lie", "the crypt lies"). */
  lies: (text) => `${text} ${isPlural(text) ? 'lie' : 'lies'}`,
  stands: (text) => `${text} ${isPlural(text) ? 'stand' : 'stands'}`,
};

function compile(alternative: Alternative): Compiled {
  const raw = typeof alternative === 'string' ? alternative : alternative.t;
  const marks = typeof alternative === 'string' ? [] : alternative.mark;
  const gate = GATE.exec(raw);
  return gate ? { gate: gate[1] ?? null, text: raw.slice(gate[0].length), marks } : { gate: null, text: raw, marks };
}

/** Index of the bracket closing the one at `open`, counting `{}` and `[]` alike. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unclosed bracket in "${text}"`);
}

function splitOptions(text: string): string[] {
  const options: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === '|' && depth === 0) {
      options.push(text.slice(start, i));
      start = i + 1;
    }
  }
  options.push(text.slice(start));
  return options;
}

export class Grammar {
  private readonly rules = new Map<string, Compiled[]>();
  private readonly overrides = new Map<string, { gate: string; key: string }[]>();
  private readonly decks = new Map<string, number[]>();
  private readonly stacks = new Map<string, Pushed[]>();
  private readonly flags = new Set<string>();
  private readonly externals: Readonly<Record<string, () => string>>;
  private marks = new Set<Mark>();

  constructor(
    rules: GrammarRules,
    private readonly rng: Rng,
    options: GrammarOptions = {},
  ) {
    this.externals = options.externals ?? {};
    for (const [key, alternatives] of Object.entries(rules)) {
      this.rules.set(key, alternatives.map(compile));
      const gated = GATE.exec(key);
      if (!gated) continue;
      const name = key.slice(gated[0].length);
      const list = this.overrides.get(name) ?? [];
      list.push({ gate: gated[1] ?? '', key });
      this.overrides.set(name, list);
    }
    for (const flag of options.flags ?? []) this.flags.add(flag);
  }

  setFlag(flag: string, on = true): void {
    if (on) this.flags.add(flag);
    else this.flags.delete(flag);
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  /** Makes `name` expand to `text` (expanded now, once) until `pop`. */
  push(name: string, text: string): void {
    const saved = this.marks;
    this.marks = new Set();
    const value = this.flatten(text, 0);
    const pushed = { text: value, marks: [...this.marks] };
    this.marks = saved;
    const stack = this.stacks.get(name) ?? [];
    stack.push(pushed);
    this.stacks.set(name, stack);
  }

  pop(name: string): void {
    this.stacks.get(name)?.pop();
  }

  expand(text: string): Expansion {
    this.marks = new Set();
    const out = this.flatten(text, 0);
    return { text: out, marks: [...this.marks] };
  }

  private flatten(text: string, depth: number): string {
    if (depth > MAX_DEPTH) throw new Error(`Grammar recursion deeper than ${MAX_DEPTH} in "${text}"`);
    let out = '';
    const pushed: string[] = [];
    let i = 0;
    while (i < text.length) {
      const c = text[i] as string;
      if (c === '#') {
        const end = text.indexOf('#', i + 1);
        if (end < 0) throw new Error(`Unclosed symbol in "${text}"`);
        out += this.symbol(text.slice(i + 1, end), depth + 1);
        i = end + 1;
      } else if (c === '{') {
        const end = closing(text, i);
        const options = splitOptions(text.slice(i + 1, end));
        const chosen = options.length === 1 ? (this.rng() < 0.5 ? (options[0] ?? '') : '') : this.choose(options);
        out += this.flatten(chosen, depth + 1);
        i = end + 1;
      } else if (c === '[') {
        const end = closing(text, i);
        const action = text.slice(i + 1, end);
        const colon = action.indexOf(':');
        if (colon < 0) throw new Error(`Malformed action "[${action}]"`);
        const name = action.slice(0, colon);
        const value = action.slice(colon + 1);
        if (value === 'POP') this.pop(name);
        else {
          this.push(name, value);
          pushed.push(name);
        }
        i = end + 1;
      } else {
        out += c;
        i++;
      }
    }
    for (const name of pushed) this.pop(name);
    return out;
  }

  private choose(options: readonly string[]): string {
    return options[Math.floor(this.rng() * options.length)] ?? '';
  }

  private symbol(reference: string, depth: number): string {
    const [name = '', ...modifiers] = reference.split('.');
    let text = this.resolve(name, depth);
    for (const modifier of modifiers) {
      const apply = MODIFIERS[modifier];
      if (!apply) throw new Error(`Unknown modifier ".${modifier}" on #${name}#`);
      text = apply(text);
    }
    return text;
  }

  private resolve(name: string, depth: number): string {
    const pushed = this.stacks.get(name);
    const top = pushed?.[pushed.length - 1];
    if (top) {
      for (const mark of top.marks) this.marks.add(mark);
      return top.text;
    }
    const external = this.externals[name];
    if (external) return external();
    const key = this.overrides.get(name)?.find((o) => this.passes(o.gate, false))?.key ?? name;
    const alternatives = this.rules.get(key);
    if (!alternatives || alternatives.length === 0) throw new Error(`Unknown symbol #${name}#`);
    const chosen = this.draw(key, alternatives);
    for (const mark of chosen.marks) this.marks.add(mark);
    return this.flatten(chosen.text, depth);
  }

  /** The next alternative of the deck whose gate holds; refills the deck, then ignores chance. */
  private draw(key: string, alternatives: readonly Compiled[]): Compiled {
    const fresh = (): number[] => shuffled(this.rng, alternatives.map((_, i) => i));
    let deck = this.decks.get(key) ?? fresh();
    for (let pass = 0; pass < 3; pass++) {
      if (pass > 0) deck = fresh();
      const at = deck.findIndex((i) => this.passes(alternatives[i]?.gate ?? null, pass < 2));
      if (at >= 0) {
        const [index] = deck.splice(at, 1);
        this.decks.set(key, deck);
        return alternatives[index as number] as Compiled;
      }
    }
    throw new Error(`No alternative of #${key}# fits flags ${[...this.flags].join(', ') || '(none)'}`);
  }

  private passes(gate: string | null, rollChance: boolean): boolean {
    if (gate === null) return true;
    return gate.split('|').some((choice) => choice.split('&').every((term) => this.term(term, rollChance)));
  }

  private term(term: string, rollChance: boolean): boolean {
    if (/^[0-9.]+$/.test(term)) return !rollChance || this.rng() < Number(term);
    if (term.startsWith('!')) return !this.flags.has(term.slice(1));
    return this.flags.has(term);
  }
}

/** An alternative that names props, water or rubble. */
export function marked(t: string, ...mark: Mark[]): Alternative {
  return { t, mark };
}
