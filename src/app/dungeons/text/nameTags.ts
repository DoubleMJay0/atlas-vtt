/**
 * Which tags the words of a dungeon's name imply: a "Temple" is ordered, spacious and pillared, a
 * "Lair" winding and dangerous, anything "Sunken" flooded. Our own table, read by `tagsFromName`.
 */

import { withTag, type DungeonTag } from '../tags';

interface WordGroup {
  words: readonly string[];
  tags: readonly DungeonTag[];
}

const GROUPS: readonly WordGroup[] = [
  { words: ['temple', 'cathedral', 'basilica', 'pantheon'], tags: ['ordered', 'large', 'spacious', 'round', 'colonnades', 'temple'] },
  { words: ['shrine', 'chapel', 'oratory', 'sanctum', 'sanctuary', 'altar'], tags: ['ordered', 'small', 'temple'] },
  { words: ['abbey', 'monastery', 'cloister', 'priory', 'convent', 'friary'], tags: ['ordered', 'colonnades', 'dwelling', 'temple'] },
  { words: ['holy', 'hallowed', 'sacred', 'blessed', 'saint', 'divine', 'pilgrim'], tags: ['ordered', 'temple'] },
  { words: ['tomb', 'crypt', 'sepulchre', 'mausoleum', 'grave', 'buried', 'burial', 'coffin', 'undercroft'], tags: ['tomb', 'ordered'] },
  { words: ['catacomb', 'catacombs', 'ossuary', 'charnel', 'barrow', 'bone', 'bones', 'skull'], tags: ['tomb', 'winding', 'cramped'] },
  { words: ['necropolis', 'cemetery', 'graveyard'], tags: ['tomb', 'large', 'square'] },
  { words: ['keep', 'fortress', 'citadel', 'bastion', 'stronghold', 'garrison', 'redoubt', 'hold', 'fort'], tags: ['ordered', 'square', 'compact'] },
  { words: ['tower', 'spire', 'steeple', 'belfry', 'minaret'], tags: ['round', 'multi-level', 'cramped'] },
  { words: ['manor', 'house', 'villa', 'lodge', 'hall', 'halls', 'home', 'hearth', 'residence'], tags: ['dwelling', 'medium'] },
  { words: ['palace', 'court', 'castle', 'throne', 'royal', 'king', 'queen', 'prince', 'duke'], tags: ['dwelling', 'large', 'spacious', 'ordered'] },
  { words: ['lair', 'den', 'nest', 'hive', 'burrow', 'warren', 'beast', 'wyrm', 'dragon'], tags: ['chaotic', 'winding', 'treasure', 'dangerous'] },
  { words: ['mine', 'mines', 'delve', 'quarry', 'diggings', 'shaft', 'shafts', 'pit', 'deeps'], tags: ['deep', 'winding', 'chaotic', 'crumbling'] },
  { words: ['cistern', 'reservoir', 'baths', 'bathhouse', 'aqueduct', 'sluice', 'sluices', 'fountain', 'wellhouse', 'spring'], tags: ['wet', 'colonnades', 'ordered'] },
  { words: ['library', 'archive', 'scriptorium', 'athenaeum', 'academy', 'observatory', 'college'], tags: ['ordered', 'dwelling', 'square'] },
  { words: ['prison', 'gaol', 'jail', 'oubliette', 'pens', 'cells', 'dungeon', 'dungeons', 'chains'], tags: ['cramped', 'dangerous', 'ordered'] },
  { words: ['cave', 'caves', 'cavern', 'grotto', 'hollows', 'sinkhole', 'chasm', 'tunnels'], tags: ['chaotic', 'winding', 'wet'] },
  { words: ['labyrinth', 'maze', 'tangle', 'warrens'], tags: ['winding', 'chaotic', 'large'] },
  { words: ['forge', 'foundry', 'smithy', 'kiln', 'kilns', 'furnace', 'smelter', 'mint', 'workshops'], tags: ['dry', 'square'] },
  { words: ['sunken', 'underwater', 'drowned', 'flooded', 'submerged', 'sodden', 'deluged', 'tide', 'sea'], tags: ['flooded'] },
  { words: ['swamp', 'marsh', 'fen', 'bog', 'mire', 'mere', 'damp', 'dripping', 'brine', 'lake', 'river', 'mossy', 'tarn'], tags: ['wet'] },
  { words: ['desert', 'dust', 'dusty', 'sand', 'sands', 'ash', 'parched', 'burnt', 'scorched', 'salt', 'cinder', 'ember', 'embers', 'burning', 'bleached'], tags: ['dry'] },
  { words: ['ruined', 'ruins', 'ruin', 'crumbling', 'broken', 'shattered', 'fallen', 'fall', 'collapsed', 'ancient', 'mountain', 'crag', 'cliffs', 'rubble'], tags: ['crumbling'] },
  { words: ['hidden', 'secret', 'veiled', 'unseen', 'concealed', 'masked', 'shrouded', 'lost', 'forgotten'], tags: ['secret'] },
  { words: ['golden', 'gold', 'gilded', 'silver', 'jewelled', 'jewel', 'gem', 'treasure', 'treasury', 'hoard', 'vault', 'coffer', 'crown', 'idol', 'idols'], tags: ['treasure'] },
  { words: ['bloody', 'blood', 'cursed', 'curse', 'deadly', 'death', 'plague', 'poison', 'venom', 'butcher', 'murder', 'doom', 'dread', 'slaughter', 'war'], tags: ['dangerous'] },
  { words: ['deep', 'depths', 'abyss', 'abyssal', 'bottomless', 'under', 'nether', 'below', 'underground', 'sunless', 'lightless'], tags: ['deep'] },
  { words: ['upper', 'lower', 'stair', 'stairs', 'tiers', 'levels', 'steps'], tags: ['multi-level'] },
  { words: ['great', 'grand', 'vast', 'huge', 'endless', 'mighty', 'colossal', 'thousand', 'countless'], tags: ['large', 'spacious'] },
  { words: ['little', 'lesser', 'small', 'minor', 'tiny'], tags: ['small'] },
  { words: ['narrow', 'tight', 'cramped', 'crooked', 'cells'], tags: ['cramped'] },
  { words: ['winding', 'twisting', 'twisted', 'serpentine', 'coiled', 'spiral', 'tangled', 'serpent'], tags: ['winding', 'chaotic'] },
  { words: ['round', 'ring', 'ringed', 'circle', 'wheel', 'rotunda', 'dome', 'moon', 'moonless'], tags: ['round'] },
  { words: ['square', 'cube', 'block', 'four'], tags: ['square'] },
  { words: ['pillared', 'pillars', 'columned', 'columns', 'colonnade', 'arches', 'vaulted'], tags: ['colonnades', 'spacious'] },
  { words: ['long', 'road', 'way', 'path', 'corridor', 'passage', 'gallery', 'aqueduct'], tags: ['string'] },
  { words: ['postern', 'gate', 'gates', 'twin', 'doors'], tags: ['backdoor'] },
  { words: ['sealed', 'walled', 'barred', 'locked', 'shut'], tags: ['no-backdoor'] },
  { words: ['flat', 'plain', 'level'], tags: ['flat'] },
];

/** Short or common words that count only as whole words, never inside a compound. */
const WHOLE_ONLY = new Set(['ring', 'hall', 'halls', 'way', 'road', 'path', 'long', 'four', 'twin', 'moon', 'level', 'plain', 'flat', 'king', 'gold', 'tide', 'lake', 'tower', 'mint', 'pens', 'home', 'cave', 'court', 'shut', 'lost', 'war', 'ash', 'sea']);

const BY_WORD: ReadonlyMap<string, readonly DungeonTag[]> = new Map(GROUPS.flatMap((group) => group.words.map((word) => [word, group.tags] as const)));

const COMPOUND_PARTS = [...BY_WORD.keys()].filter((word) => word.length >= 4 && !WHOLE_ONLY.has(word));

function wordTags(word: string): readonly DungeonTag[] {
  const forms = [word, word.replace(/'s$/, ''), word.replace(/s$/, ''), word.replace(/es$/, '')];
  for (const form of forms) {
    const tags = BY_WORD.get(form);
    if (tags) return tags;
  }
  const parts = COMPOUND_PARTS.filter((part) => word.length > part.length && (word.startsWith(part) || word.endsWith(part)));
  return parts.flatMap((part) => BY_WORD.get(part) ?? []);
}

/** The tags a name implies, rivals resolved in the order the words come. */
export function tagsFromName(name: string): DungeonTag[] {
  const words = name.toLowerCase().split(/[^a-z']+/).filter((word) => word.length > 1);
  return words.flatMap(wordTags).reduce<DungeonTag[]>((tags, tag) => (tags.includes(tag) ? tags : withTag(tags, tag)), []);
}
