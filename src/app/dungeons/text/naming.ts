/**
 * Names a dungeon and tells its story (report 7.2): up to twenty titles are tried until one's words
 * imply every tag the GM asked for (else the one missing fewest), the GM's tags are merged over the
 * implied ones, a few tags are added by chance, and the story is written with the result.
 */

import type { Rng } from '../rng';
import { chance, stream, weighted } from '../rng';
import { readTags, rivalsOf, withTag, type DungeonTag } from '../tags';
import type { StoryContext } from './contract';
import { capitalizeAll, tidy } from './english';
import type { Grammar } from './grammar';
import { tagsFromName } from './nameTags';
import { PLACES, placeInTitle, placeKindWeights, type PlaceKind } from './rules/places';
import { TAG_ADJECTIVE_FLAGS } from './rules/titles';
import { flagsFor, popFacts, pushFacts, tagFlag, textGrammar, type Inhabitants } from './textGrammar';

const TITLE_TRIES = 20;

interface Draft {
  title: string;
  facts: Record<string, string>;
}

function inhabitantWeights(tags: readonly DungeonTag[]): [Inhabitants, number][] {
  return [
    ['raiders', 3 + (tags.includes('treasure') ? 1 : 0)],
    ['vermin', 2 + (tags.includes('crumbling') ? 1 : 0)],
    ['beast', 2 + (tags.includes('dangerous') ? 2 : 0)],
  ];
}

function pickPlace(rng: Rng, tags: readonly DungeonTag[], given: string | undefined): { noun: string; kind: PlaceKind } {
  const named = given ? placeInTitle(given) : null;
  if (named) return named;
  const kind = weighted(rng, placeKindWeights(tags));
  const nouns = PLACES[kind];
  return { noun: nouns[Math.floor(rng() * nouns.length)] ?? kind, kind };
}

/** The facts one attempt fixes, then its title (the GM's own when given). */
function draft(rng: Rng, grammar: Grammar, tags: readonly DungeonTag[], given: string | undefined): Draft {
  const place = pickPlace(rng, tags, given);
  const facts: Record<string, string> = {
    place: place.noun,
    placeKind: place.kind,
    inhabitants: weighted(rng, inhabitantWeights(tags)),
  };
  const boss = chance(rng, 2 / 3);
  grammar.setFlag('BOSS', boss);
  for (const kind of Object.keys(PLACES)) grammar.setFlag(`P_${kind.toUpperCase()}`, kind === place.kind);
  if (boss) facts.boss = grammar.expand('#bossKind#').text;
  facts.raider = grammar.expand('#raiderKind#').text;
  facts.vermin = grammar.expand('#verminKind#').text;
  facts.beast = grammar.expand('#beastKind#').text;
  facts.symbol = grammar.expand('#symbolKind#').text;
  facts.landmark = grammar.expand('#landmarkKind#').text;
  facts.wild = grammar.expand('#wildKind#').text;
  if (given) return { title: given, facts };
  pushFacts(grammar, facts);
  const title = capitalizeAll(tidy(grammar.expand('#title#').text));
  popFacts(grammar, facts);
  return { title, facts };
}

function missing(requested: readonly DungeonTag[], title: string): number {
  const implied = tagsFromName(title);
  return requested.filter((tag) => !implied.includes(tag)).length;
}

/** Tags the generator adds by chance, unless a tag already present rules them out. */
function withChanceTags(rng: Rng, tags: DungeonTag[]): DungeonTag[] {
  let out = tags;
  const roll = (tag: DungeonTag, p: number, unless: readonly DungeonTag[] = []): void => {
    const hit = chance(rng, p);
    const blocked = [...rivalsOf(tag), ...unless].some((t) => out.includes(t));
    if (hit && !blocked && !out.includes(tag)) out = withTag(out, tag);
  };
  roll('multi-level', 0.5);
  roll('string', 0.05, ['winding']);
  roll('deep', 0.05);
  return out;
}

export function nameDungeon(seed: number, tags: readonly DungeonTag[], name?: string): StoryContext {
  const requested = readTags(tags);
  const given = name?.trim() || undefined;
  const rng = stream(seed, 'text', 'story');
  const drafting = textGrammar(rng, requested.map(tagFlag));
  drafting.setFlag('TAGGED', requested.some((tag) => TAG_ADJECTIVE_FLAGS.has(tagFlag(tag))));

  let best: Draft | null = null;
  let fewest = Infinity;
  for (let attempt = 0; attempt < (given ? 1 : TITLE_TRIES) && fewest > 0; attempt++) {
    const candidate = draft(rng, drafting, requested, given);
    const lacking = missing(requested, candidate.title);
    if (lacking < fewest) {
      best = candidate;
      fewest = lacking;
    }
  }
  if (!best) throw new Error('No dungeon title drafted');

  const merged = requested.reduce<DungeonTag[]>((out, tag) => withTag(out, tag), tagsFromName(best.title));
  const finalTags = withChanceTags(rng, merged);
  const facts = best.facts;

  const writer = textGrammar(rng, flagsFor(finalTags, facts));
  pushFacts(writer, facts);
  facts.keyLook = writer.expand('#keyLookKind#').text;
  facts.artefact = writer.expand('#artefactKind#').text;
  writer.push('keyLook', facts.keyLook);
  writer.push('artefact', facts.artefact);
  const story = tidy(writer.expand('#story#').text);

  return {
    title: best.title,
    story,
    tags: finalTags,
    boss: facts.boss ?? null,
    placeNoun: facts.place ?? 'dungeon',
    keyLook: facts.keyLook,
    facts,
  };
}
