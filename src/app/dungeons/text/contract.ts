/**
 * The seam between layout and words. Generation runs in this order:
 *   1. `nameDungeon` (text): the title, the tags it implies merged with the GM's, the story.
 *   2. layout and plan (layout/, plan/): rooms, doors, and what each room holds (`RoomPlan`).
 *   3. `writeNotes` (text): a note for every room whose plan says something.
 *   4. props (props.ts): placed from the plan and from what the notes asked for (`NoteText.props`).
 * Text never reads geometry beyond `RoomPlan`, and layout never parses note text.
 */

import type { CellDir, PropKind } from '../model';
import type { DungeonTag } from '../tags';

/** Fixed for the whole dungeon, so every mention agrees. */
export interface StoryContext {
  title: string;
  story: string;
  /** The GM's tags merged with the ones the title implies (rivals resolved, GM wins). */
  tags: DungeonTag[];
  /** Null when the dungeon has no boss. */
  boss: string | null;
  /** What the place is ("temple", "crypt"); feeds room words and the backdoor note. */
  placeNoun: string;
  /** One adjective for every key ("brass"), so all keys of a dungeon match. */
  keyLook: string;
  /** Opaque facts the text module keeps for `writeNotes` (races, symbol, artefact). */
  facts: Readonly<Record<string, string>>;
}

export type RoomFeature =
  | { kind: 'environment' }
  | { kind: 'enemy' }
  | { kind: 'loot' }
  | { kind: 'event' }
  /** The room in front of the locked gate; `side` is the gate's wall as seen from inside. */
  | { kind: 'gate'; side: CellDir; keyholes: number }
  | { kind: 'key' }
  | { kind: 'backdoor'; side: CellDir }
  | { kind: 'stairs-down' };

export interface RoomPlan {
  room: number;
  /** Floor cells; picks "small room", "room", "hall" (≥ 21) and the like. */
  area: number;
  corridor: boolean;
  rotunda: boolean;
  inSecretWing: boolean;
  ending: boolean;
  features: RoomFeature[];
}

export interface NoteText {
  room: number;
  text: string;
  /** Props the note mentions; props.ts puts them in the room's aisle. */
  props: PropKind[];
  /** The note mentions a pool or puddle: the room gets water. */
  water: boolean;
  /** The note mentions rubble or debris: three more stones. */
  rubble: boolean;
}

export interface DungeonText {
  nameDungeon(seed: number, tags: readonly DungeonTag[], name?: string): StoryContext;
  /** Notes in no particular order; numbering is the layout's (path distance). */
  writeNotes(seed: number, story: StoryContext, plans: readonly RoomPlan[]): NoteText[];
}
