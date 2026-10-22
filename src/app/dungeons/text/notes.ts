/**
 * Room notes: one per room whose plan holds something, its sentences in a fixed order, the room
 * word picked by the room's size and the gate's or back door's wall named from inside the room.
 * The props, water and rubble a note gets are the marks of the rules that wrote it.
 */

import type { CellDir, PropKind } from '../model';
import { stream } from '../rng';
import type { NoteText, RoomFeature, RoomPlan, StoryContext } from './contract';
import { numberWord, tidy } from './english';
import type { Grammar, Mark } from './grammar';
import { flagsFor, pushFacts, textGrammar } from './textGrammar';

/** Sentences of a note come in this order, whatever order the plan lists them in. */
const ORDER: readonly RoomFeature['kind'][] = ['environment', 'enemy', 'backdoor', 'event', 'gate', 'loot', 'key', 'stairs-down'];

const SYMBOL: Readonly<Record<RoomFeature['kind'], string>> = {
  environment: '#environment#',
  enemy: '#enemy#',
  loot: '#loot#',
  event: '#event#',
  gate: '#gate#',
  key: '#key#',
  backdoor: '#backdoor#',
  'stairs-down': '#stairsDown#',
};

/** What a room is called, by its floor area: halls from 21 cells, rooms from 15. */
export function roomWord(plan: RoomPlan): string {
  if (plan.corridor) return '{corridor|passage}';
  if (plan.rotunda) return plan.area >= 15 ? '{rotunda|round hall}' : 'round chamber';
  if (plan.area >= 21) return '{hall|large chamber|large room}';
  if (plan.area >= 15) return '{room|chamber}';
  return '{small room|small chamber}';
}

/** The compass name of a wall seen from inside ("north", "south-west") and its adjective. */
export function sideWords(side: CellDir): { side: string; adjective: string } {
  const ns = side.y < 0 ? 'north' : side.y > 0 ? 'south' : '';
  const ew = side.x < 0 ? 'west' : side.x > 0 ? 'east' : '';
  if (ns && ew) return { side: `${ns}-${ew}`, adjective: `${ns}-${ew}ern` };
  const one = ns || ew || 'north';
  return { side: one, adjective: `${one}ern` };
}

function sentence(grammar: Grammar, feature: RoomFeature): { text: string; marks: Mark[] } {
  const pushed: string[] = [];
  const push = (name: string, value: string): void => {
    grammar.push(name, value);
    pushed.push(name);
  };
  if (feature.kind === 'gate' || feature.kind === 'backdoor') {
    const words = sideWords(feature.side);
    push('side', words.side);
    push('sideAdj', words.adjective);
  }
  if (feature.kind === 'gate') {
    push('keyCount', numberWord(feature.keyholes));
    grammar.setFlag('K0', feature.keyholes === 0);
    grammar.setFlag('K1', feature.keyholes === 1);
  }
  const expansion = grammar.expand(SYMBOL[feature.kind]);
  for (const name of pushed) grammar.pop(name);
  return { text: tidy(expansion.text), marks: expansion.marks };
}

function writeNote(grammar: Grammar, plan: RoomPlan): NoteText {
  grammar.setFlag('ENDING', plan.ending);
  grammar.setFlag('CORRIDOR', plan.corridor);
  grammar.setFlag('SECRET_WING', plan.inSecretWing);
  grammar.push('room', roomWord(plan));
  const features = [...plan.features].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const sentences = features.map((feature) => sentence(grammar, feature));
  grammar.pop('room');
  const marks = new Set(sentences.flatMap((s) => s.marks));
  const props = [...marks].filter((mark): mark is PropKind => mark !== 'water' && mark !== 'rubble');
  return {
    room: plan.room,
    text: sentences.map((s) => s.text).join(' '),
    props,
    water: marks.has('water'),
    rubble: marks.has('rubble'),
  };
}

export function writeNotes(seed: number, story: StoryContext, plans: readonly RoomPlan[], variant = 0): NoteText[] {
  const rng = stream(seed, 'text', variant ? `notes#${variant}` : 'notes');
  const facts = { ...story.facts, keyLook: story.keyLook, place: story.placeNoun, ...(story.boss ? { boss: story.boss } : {}) };
  const grammar = textGrammar(rng, flagsFor(story.tags, facts));
  pushFacts(grammar, facts);
  return [...plans]
    .sort((a, b) => a.room - b.room)
    .filter((plan) => plan.features.length > 0)
    .map((plan) => writeNote(grammar, plan));
}
