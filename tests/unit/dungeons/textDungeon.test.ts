import { describe, expect, it } from 'vitest';
import type { CellDir } from '../../../src/app/dungeons/model';
import { int, pick, rngFrom, type Rng } from '../../../src/app/dungeons/rng';
import { DUNGEON_TAGS, readTags, type DungeonTag } from '../../../src/app/dungeons/tags';
import type { RoomFeature, RoomPlan, StoryContext } from '../../../src/app/dungeons/text/contract';
import { dungeonText } from '../../../src/app/dungeons/text/dungeonText';
import { numberWord, startsWithVowelSound } from '../../../src/app/dungeons/text/english';

const SEEDS = 2000;
const SIDES: CellDir[] = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }];

function tagsFor(rng: Rng): DungeonTag[] {
  return readTags(Array.from({ length: int(rng, 0, 4) }, () => pick(rng, DUNGEON_TAGS)));
}

function feature(rng: Rng): RoomFeature {
  const kind = pick(rng, ['environment', 'enemy', 'loot', 'loot', 'event', 'gate', 'key', 'backdoor', 'stairs-down'] as const);
  if (kind === 'gate') return { kind, side: pick(rng, SIDES), keyholes: int(rng, 0, 4) };
  if (kind === 'backdoor') return { kind, side: pick(rng, SIDES) };
  return { kind };
}

function plansFor(rng: Rng): RoomPlan[] {
  return Array.from({ length: int(rng, 3, 12) }, (_, room) => ({
    room,
    area: int(rng, 4, 40),
    corridor: rng() < 0.15,
    rotunda: rng() < 0.1,
    inSecretWing: rng() < 0.1,
    ending: room === 0,
    features: Array.from({ length: int(rng, 0, 3) }, () => feature(rng)).filter(
      (f, i, all) => f.kind === 'loot' || all.findIndex((other) => other.kind === f.kind) === i,
    ),
  }));
}

/** Everything wrong with a printed passage, as readable complaints. */
function problems(text: string): string[] {
  const found: string[] = [];
  if (/[#{}[\]]/.test(text)) found.push('unexpanded grammar');
  if (/\b(undefined|null|NaN)\b/.test(text)) found.push('missing value');
  if (/ {2}/.test(text) || text !== text.trim()) found.push('stray spaces');
  if (/ [,.;:!?]|,[.;]|\.\./.test(text)) found.push('bad punctuation');
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (!/^["']?[A-Z]/.test(sentence)) found.push(`lowercase start: "${sentence}"`);
    if (!/[.!?]$/.test(sentence)) found.push(`no full stop: "${sentence}"`);
  }
  for (const [, art, word] of text.matchAll(/\b(a|an|A|An) ([A-Za-z][\w-]*)/g)) {
    if (startsWithVowelSound(word as string) !== (art?.toLowerCase() === 'an')) found.push(`"${art} ${word}"`);
  }
  return found;
}

function dungeon(seed: number): { story: StoryContext; plans: RoomPlan[]; requested: DungeonTag[] } {
  const rng = rngFrom(seed * 7919);
  const requested = tagsFor(rng);
  return { story: dungeonText.nameDungeon(seed, requested), plans: plansFor(rng), requested };
}

describe('dungeon text over many seeds', () => {
  it('writes clean titles, stories and notes', () => {
    const complaints: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { story, plans, requested } = dungeon(seed);
      for (const tag of requested) if (!story.tags.includes(tag)) complaints.push(`${seed}: lost tag ${tag}`);
      if (!story.title || /[#{}[\]]|undefined|null/.test(story.title)) complaints.push(`${seed}: title "${story.title}"`);
      complaints.push(...problems(story.story).map((p) => `${seed} story: ${p} in "${story.story}"`));
      const notes = dungeonText.writeNotes(seed, story, plans);
      const expected = plans.filter((plan) => plan.features.length > 0).map((plan) => plan.room);
      expect(notes.map((note) => note.room).sort((a, b) => a - b)).toEqual(expected);
      for (const note of notes) {
        complaints.push(...problems(note.text).map((p) => `${seed} room ${note.room}: ${p} in "${note.text}"`));
        const gate = plans[note.room]?.features.find((f) => f.kind === 'gate');
        if (gate?.kind === 'gate') {
          const ok = gate.keyholes === 0
            ? !/\bkeyholes?\b/.test(note.text.replace(/(no|without) keyhole/g, ''))
            : gate.keyholes === 1
              ? /\b(one|single) keyhole\b/.test(note.text)
              : note.text.includes(`${numberWord(gate.keyholes)} keyholes`);
          if (!ok) complaints.push(`${seed} room ${note.room}: ${gate.keyholes} keyholes in "${note.text}"`);
        }
        if (/\bkey\b/i.test(note.text) && plans[note.room]?.features.some((f) => f.kind === 'key') && !note.text.includes(`${story.keyLook} key`)) {
          complaints.push(`${seed} room ${note.room}: key without "${story.keyLook}" in "${note.text}"`);
        }
      }
    }
    expect(complaints.slice(0, 20)).toEqual([]);
  });

  it('is deterministic per seed, tags and plans', () => {
    for (const seed of [1, 42, 1234567]) {
      const a = dungeon(seed);
      const b = dungeon(seed);
      expect(b.story).toEqual(a.story);
      expect(dungeonText.writeNotes(seed, b.story, b.plans)).toEqual(dungeonText.writeNotes(seed, a.story, a.plans));
    }
  });

  it('names notes order-independently and only for rooms with features', () => {
    const { story, plans } = dungeon(9);
    expect(dungeonText.writeNotes(9, story, [...plans].reverse())).toEqual(dungeonText.writeNotes(9, story, plans));
  });

  it('marks what a note mentions', () => {
    let watery = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const story = dungeonText.nameDungeon(seed, ['flooded', 'tomb']);
      const plans: RoomPlan[] = [{ room: 1, area: 16, corridor: false, rotunda: false, inSecretWing: false, ending: false, features: [{ kind: 'environment' }, { kind: 'loot' }] }];
      for (const note of dungeonText.writeNotes(seed, story, plans)) {
        if (note.water) watery++;
        if (/\bsarcophagus\b/.test(note.text)) expect(note.props).toContain('sarcophagus');
        if (/\bchest\b/.test(note.text)) expect(note.props).toContain('chest');
      }
    }
    expect(watery).toBeGreaterThan(20);
  });
});

describe('naming', () => {
  it('keeps a given name and derives tags from its words', () => {
    const story = dungeonText.nameDungeon(5, ['dry'], '  The Sunken Temple of Ash  ');
    expect(story.title).toBe('The Sunken Temple of Ash');
    expect(story.placeNoun).toBe('temple');
    expect(story.tags).toEqual(expect.arrayContaining(['temple', 'colonnades', 'dry']));
    expect(story.tags).not.toContain('flooded');
  });

  it('usually finds a title that implies the requested tags', () => {
    let implied = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const story = dungeonText.nameDungeon(seed, ['flooded']);
      if (/sunken|drowned|flooded|brine|tide|sea/i.test(story.title)) implied++;
    }
    expect(implied).toBeGreaterThan(150);
  });

  it('gives about two dungeons in three a boss', () => {
    const bosses = Array.from({ length: 600 }, (_, i) => dungeonText.nameDungeon(i + 1, [])).filter((s) => s.boss).length;
    expect(bosses).toBeGreaterThan(330);
    expect(bosses).toBeLessThan(470);
  });

  it('never adds a tag that pushes out a requested one', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const story = dungeonText.nameDungeon(seed, ['single-level', 'winding', 'flat', 'secret']);
      expect(story.tags).not.toContain('multi-level');
      expect(story.tags).not.toContain('string');
      expect(story.tags).not.toContain('deep');
    }
  });
});

describe.runIf(process.env.DUNGEON_TEXT_SAMPLES)('samples', () => {
  it('prints sample dungeons', () => {
    const tagSets: DungeonTag[][] = [[], ['tomb'], ['temple', 'wet'], ['dangerous', 'treasure'], ['crumbling'], ['dwelling'], ['flooded'], ['dry', 'large']];
    for (let i = 0; i < 15; i++) {
      const seed = 1000 + i * 37;
      const tags = tagSets[i % tagSets.length] ?? [];
      const story = dungeonText.nameDungeon(seed, tags);
      const plans = plansFor(rngFrom(seed)).slice(0, 6).map((p, room) => ({ ...p, room, ending: room === 5, features: p.features.length ? p.features : [{ kind: 'loot' as const }] }));
      const notes = dungeonText.writeNotes(seed, story, plans);
      console.log(`\n## ${story.title}  [${story.tags.join(', ')}]\n${story.story}\n${notes.map((n) => `${n.room + 1}. ${n.text}`).join('\n')}`);
    }
  });
});
