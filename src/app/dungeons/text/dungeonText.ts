import type { DungeonText } from './contract';
import { nameDungeon } from './naming';
import { writeNotes } from './notes';

/** Every word of a generated dungeon: its name, story and room notes, all from the text stream. */
export const dungeonText: DungeonText = { nameDungeon, writeNotes };
