/**
 * The tags a GM can ask a dungeon for. Ids are stored (note frontmatter, exports) and never
 * translated or renamed; what each does is shown through `t('dungeon.tag.<i18nKey>')`.
 */

export const DUNGEON_TAGS = [
  'backdoor',
  'no-backdoor',
  'chaotic',
  'ordered',
  'colonnades',
  'compact',
  'winding',
  'cramped',
  'spacious',
  'crumbling',
  'dangerous',
  'deep',
  'flat',
  'dry',
  'wet',
  'flooded',
  'dwelling',
  'small',
  'medium',
  'large',
  'multi-level',
  'single-level',
  'secret',
  'no-secrets',
  'round',
  'square',
  'string',
  'temple',
  'tomb',
  'treasure',
] as const;

export type DungeonTag = (typeof DUNGEON_TAGS)[number];

/** Tags that rule each other out: picking one drops the others of every group it is in. */
const EXCLUSIVE: readonly (readonly DungeonTag[])[] = [
  ['backdoor', 'no-backdoor'],
  ['chaotic', 'ordered'],
  ['compact', 'winding'],
  ['cramped', 'spacious'],
  ['deep', 'flat'],
  ['dry', 'wet', 'flooded'],
  ['small', 'medium', 'large'],
  ['multi-level', 'single-level'],
  ['secret', 'no-secrets'],
  ['secret', 'string'],
  ['round', 'square'],
];

function isDungeonTag(value: string): value is DungeonTag {
  return (DUNGEON_TAGS as readonly string[]).includes(value);
}

/** The tags `tag` rules out. */
export function rivalsOf(tag: DungeonTag): DungeonTag[] {
  return EXCLUSIVE.filter((group) => group.includes(tag)).flatMap((group) => group.filter((t) => t !== tag));
}

/** `tags` with `tag` added and its rivals removed; later tags win over earlier ones. */
export function withTag(tags: readonly DungeonTag[], tag: DungeonTag): DungeonTag[] {
  const rivals = rivalsOf(tag);
  return [...tags.filter((t) => t !== tag && !rivals.includes(t)), tag];
}

/** Reads stored or typed tags: unknown ones are dropped, rivals resolved in order. */
export function readTags(values: readonly string[]): DungeonTag[] {
  return values.filter(isDungeonTag).reduce<DungeonTag[]>((tags, tag) => withTag(tags, tag), []);
}

/** The i18n key segment of a tag (`multi-level` → `multiLevel`). */
export function tagKey(tag: DungeonTag): string {
  return tag.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}
