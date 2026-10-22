import type { NotePin } from '../../types';
import type { DungeonModel, DungeonNote } from '../model';
import { roomCentre } from '../render/geometry';
import { visibleDungeon } from '../render/visibleDungeon';
import type { DungeonView } from '../style';
import type { DungeonPlacement } from './toWalls';

/** The frontmatter key that holds what rebuilds the dungeon: generator version, seed and tags. */
export const DUNGEON_PROPERTY = 'atlas-dungeon';

/** The pin icon that shows its label, a room's number. */
const NUMBER_PIN = 'number';

/** One line of text, as a heading or an italic paragraph can hold it. */
const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Text set in `*…*`: its own asterisks and underscores escaped, so the emphasis ends where it should. */
const italic = (text: string): string => `*${oneLine(text).replace(/([\\*_])/g, '\\$1')}*`;

/** A JSON string is a YAML double-quoted scalar, so any tag is written safely. */
const yamlString = (text: string): string => JSON.stringify(text);

/** The notes of the rooms a view shows, in the order of their numbers. */
export function shownNotes(model: DungeonModel, view: Pick<DungeonView, 'secrets'>): DungeonNote[] {
  const shown = new Set(visibleDungeon(model, view).rooms.map(room => room.id));
  return model.notes
    .filter(note => shown.has(note.room))
    .sort((a, b) => Number(a.ref) - Number(b.ref) || a.ref.localeCompare(b.ref));
}

/**
 * A dungeon's note: frontmatter that rebuilds the dungeon (`atlas-dungeon`: version, seed, tags),
 * the title, the story in italics, and one heading per numbered room, `## 1`, `## 2`…, holding
 * that room's note, so a pin can link `note#1`. Pure.
 */
export function dungeonNoteText(model: DungeonModel, view: Pick<DungeonView, 'secrets'>): string {
  const frontmatter = [
    '---',
    `${DUNGEON_PROPERTY}:`,
    `  version: ${model.version}`,
    `  seed: ${model.seed}`,
    `  tags: [${model.tags.map(yamlString).join(', ')}]`,
    '---',
  ];
  const parts = [frontmatter.join('\n'), `# ${oneLine(model.title)}`];
  if (model.story.trim()) parts.push(italic(model.story));
  for (const note of shownNotes(model, view)) parts.push(`## ${note.ref}\n\n${note.text.trim()}`);
  return `${parts.join('\n\n')}\n`;
}

/**
 * One pin per numbered room, on the room's number in the middle of the room, linking the room's
 * heading of the note at `notePath`. The pins are the GM's: the map shows players the numbers.
 */
export function dungeonPins(model: DungeonModel, view: Pick<DungeonView, 'secrets'>, placement: DungeonPlacement, notePath: string): Record<string, NotePin> {
  const rooms = new Map(model.rooms.map(room => [room.id, room] as const));
  const { originCell, pxPerCell } = placement;
  const pins: Record<string, NotePin> = {};
  for (const note of shownNotes(model, view)) {
    const room = rooms.get(note.room);
    if (!room) continue;
    const centre = roomCentre(room);
    const id = `pin_dungeon_${note.ref}`;
    pins[id] = {
      id,
      kind: 'pin',
      x: (centre.x - originCell.x) * pxPerCell,
      y: (centre.y - originCell.y) * pxPerCell,
      notePath: `${notePath}#${note.ref}`,
      icon: NUMBER_PIN,
      label: note.ref,
      gmOnly: true,
    };
  }
  return pins;
}
