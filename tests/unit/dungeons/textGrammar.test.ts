import { describe, expect, it } from 'vitest';
import { article, capitalizeAll, isPlural, plural, tidy } from '../../../src/app/dungeons/text/english';
import { Grammar, marked } from '../../../src/app/dungeons/text/grammar';
import { rngFrom } from '../../../src/app/dungeons/rng';

const grammar = (rules: ConstructorParameters<typeof Grammar>[0], flags: string[] = [], seed = 1): Grammar =>
  new Grammar(rules, rngFrom(seed), { flags });

describe('english helpers', () => {
  it('picks a or an by sound', () => {
    expect(article('iron key')).toBe('an iron key');
    expect(article('brass key')).toBe('a brass key');
    expect(article('one-eyed ape')).toBe('a one-eyed ape');
    expect(article('hourglass')).toBe('an hourglass');
    expect(article('unicorn')).toBe('a unicorn');
    expect(article('urn')).toBe('an urn');
  });

  it('pluralizes the head noun of a phrase', () => {
    expect(plural('giant centipede')).toBe('giant centipedes');
    expect(plural('wild man')).toBe('wild men');
    expect(plural('bog-man')).toBe('bog-men');
    expect(plural('wolf')).toBe('wolves');
    expect(plural('giant fly')).toBe('giant flies');
    expect(plural('leech')).toBe('leeches');
    expect(plural('band of goblins')).toBe('bands of goblins');
  });

  it('tells plural places from singular ones', () => {
    expect(isPlural('catacombs')).toBe(true);
    expect(isPlural('halls of Ysmar')).toBe(true);
    expect(isPlural('fortress')).toBe(false);
    expect(isPlural('wild men')).toBe(true);
    expect(isPlural('abyss')).toBe(false);
  });

  it('title-cases and tidies', () => {
    expect(capitalizeAll('crypt of the pale abbot')).toBe('Crypt of the Pale Abbot');
    expect(tidy('a  rusted key , here . then more')).toBe('A rusted key, here. Then more');
  });
});

describe('Grammar', () => {
  it('expands symbols with modifiers and agreement', () => {
    const g = grammar({ place: ['halls'], beast: ['owl'] });
    expect(g.expand('#place.is# old; #beast.a.capitalize# waits; #place.their# doors').text).toBe(
      'halls are old; An owl waits; their doors',
    );
  });

  it('does not repeat an alternative before its deck runs out', () => {
    const g = grammar({ x: ['a', 'b', 'c', 'd'] });
    const drawn = [0, 1, 2, 3].map(() => g.expand('#x#').text);
    expect(new Set(drawn).size).toBe(4);
  });

  it('honours flag gates with negation, AND and OR', () => {
    const rules = { x: ['WET?-wet', '!WET&DRY?-dry', 'TOMB|TEMPLE?-holy'] };
    expect(grammar(rules, ['WET']).expand('#x#').text).toBe('wet');
    expect(grammar(rules, ['DRY']).expand('#x#').text).toBe('dry');
    expect(grammar(rules, ['TEMPLE']).expand('#x#').text).toBe('holy');
    expect(() => grammar(rules, []).expand('#x#')).toThrow(/No alternative/);
  });

  it('keeps probability-gated alternatives about as often as asked', () => {
    const g = grammar({ x: ['0.2?-rare', 'common', 'common', 'common', 'common'] });
    const rare = Array.from({ length: 2000 }, () => g.expand('#x#').text).filter((t) => t === 'rare').length;
    expect(rare).toBeGreaterThan(150);
    expect(rare).toBeLessThan(450);
  });

  it('overrides a symbol while its flag is set', () => {
    const rules = { 'WET?-spot': ['in a pool'], spot: ['in a chest'] };
    expect(grammar(rules, ['WET']).expand('#spot#').text).toBe('in a pool');
    expect(grammar(rules).expand('#spot#').text).toBe('in a chest');
  });

  it('expands inline choices and optional parts', () => {
    const g = grammar({});
    const seen = new Set(Array.from({ length: 50 }, () => g.expand('{a|b|c}{!}').text));
    expect(seen).toEqual(new Set(['a', 'b', 'c', 'a!', 'b!', 'c!']));
  });

  it('pushes context symbols for a rule and pops them after', () => {
    const g = grammar({ hero: ['[name:#who#]#name# meets #name#'], who: ['Ann', 'Bo'] });
    const text = g.expand('#hero#').text;
    expect(text === 'Ann meets Ann' || text === 'Bo meets Bo').toBe(true);
    expect(() => g.expand('#name#')).toThrow(/Unknown symbol/);
    g.push('name', 'Cy');
    expect(g.expand('#name#').text).toBe('Cy');
    g.pop('name');
    expect(() => g.expand('#name#')).toThrow(/Unknown symbol/);
  });

  it('collects the marks of the alternatives used', () => {
    const g = grammar({ spot: [marked('in a chest', 'chest')], pool: [marked('in a pool', 'water')] });
    expect(g.expand('#spot#, #pool#').marks.sort()).toEqual(['chest', 'water']);
    expect(g.expand('nothing').marks).toEqual([]);
  });

  it('is deterministic for a seed', () => {
    const rules = { x: ['a', 'b', 'c', 'd', 'e', 'f'] };
    const run = (): string => Array.from({ length: 10 }, () => grammar(rules, [], 7).expand('#x##x##x#').text).join();
    expect(run()).toBe(run());
  });

  it('throws on endless recursion, unknown symbols and unknown modifiers', () => {
    expect(() => grammar({ loop: ['#loop#'] }).expand('#loop#')).toThrow(/recursion/);
    expect(() => grammar({}).expand('#nope#')).toThrow(/Unknown symbol/);
    expect(() => grammar({ x: ['y'] }).expand('#x.shout#')).toThrow(/Unknown modifier/);
  });

  it('calls external symbols afresh each time', () => {
    let n = 0;
    const g = new Grammar({}, rngFrom(1), { externals: { Name: () => `N${++n}` } });
    expect(g.expand('#Name# #Name#').text).toBe('N1 N2');
  });
});
