// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { applyDungeonEdits, NO_EDITS, withNoteEdit, withoutNoteTexts, withWingHidden } from '../../src/app/dungeons/edits';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { dungeonNoteText, dungeonPins, shownNotes } from '../../src/app/dungeons/scene/dungeonNote';
import { dungeonWalls } from '../../src/app/dungeons/scene/toWalls';
import { secretWingOf } from '../../src/app/dungeons/secretWings';
import { generateDungeon } from '../../src/app/dungeons/generate';
import { DEFAULT_DUNGEON_GENERATOR_SETTINGS, readDungeonGeneratorSettings } from '../../src/app/dungeons/generatorSettings';
import { roomsByDistance } from '../../src/app/dungeons/numbering';
import { DEFAULT_VIEW, STYLE_LIMITS, STYLE_PRESETS } from '../../src/app/dungeons/style';
import { paletteFileText, readDungeonStyle, readPaletteFile } from '../../src/app/dungeons/styleJson';
import { dungeonText } from '../../src/app/dungeons/text/dungeonText';
import { readStoredSettings } from '../../src/app/services/atlasSettings';
import { SettingsService } from '../../src/app/services/SettingsService';

describe('reading the generator settings', () => {
  it('gives the defaults for nothing stored', () => {
    expect(readDungeonGeneratorSettings(undefined)).toEqual(DEFAULT_DUNGEON_GENERATOR_SETTINGS);
    expect(readStoredSettings({}, 'mouse').settings.dungeonGenerator).toEqual(DEFAULT_DUNGEON_GENERATOR_SETTINGS);
  });

  it('holds every number within the style limits and drops what it cannot read', () => {
    const read = readDungeonGeneratorSettings({
      preset: 'custom',
      style: { colors: { ink: 'red', paper: '#ABCDEF' }, strokes: { thick: 99 }, hatching: { mode: 'wavy', strokes: 3.6 }, fonts: { title: { size: 2, face: 'comic' } } },
      view: { grid: 'hexes', water: false },
      tags: ['small', 'large', 'unknown', 7],
    });
    expect(read.preset).toBe('custom');
    expect(read.style.colors.ink).toBe(STYLE_PRESETS.parchment.colors.ink);
    expect(read.style.colors.paper).toBe('#abcdef');
    expect(read.style.strokes.thick).toBe(STYLE_LIMITS.strokeThick[1]);
    expect(read.style.hatching).toMatchObject({ mode: 'hatching', strokes: 4 });
    expect(read.style.fonts.title).toMatchObject({ size: STYLE_LIMITS.fontSize[0], face: 'title' });
    expect(read.view).toEqual({ ...DEFAULT_VIEW, water: false });
    // Rivals resolve in order: the later size wins
    expect(read.tags).toEqual(['large']);
  });

  it('reads a preset name it does not know as the default preset', () => {
    expect(readDungeonGeneratorSettings({ preset: 'neon' }).preset).toBe(DEFAULT_DUNGEON_GENERATOR_SETTINGS.preset);
  });

  it('keeps what the GM chose in Atlas settings', () => {
    const settings = new SettingsService({} as App);
    settings.setDungeonGenerator({ view: { ...DEFAULT_VIEW, monochrome: true }, tags: ['tomb'] });
    expect(settings.getDungeonGenerator()).toMatchObject({ view: { monochrome: true }, tags: ['tomb'], preset: 'parchment' });
  });
});

describe('palette files', () => {
  it('reads back what it saved', () => {
    expect(readPaletteFile(paletteFileText(STYLE_PRESETS.slate))).toEqual(STYLE_PRESETS.slate);
  });

  it('refuses text that is no palette', () => {
    expect(readPaletteFile('not json')).toBeNull();
    expect(readPaletteFile(JSON.stringify({ style: STYLE_PRESETS.slate }))).toBeNull();
  });

  it('fills fields a palette lacks from the base', () => {
    expect(readDungeonStyle({ colors: { ink: '#123456' } }).strokes).toEqual(STYLE_PRESETS.parchment.strokes);
  });
});

describe('the GM’s edits on a dungeon', () => {
  const model = generateDungeon({ seed: 4242, tags: ['medium'] }, dungeonText);
  const unnoted = model.rooms.find((room) => room.kind === 'room' && !model.notes.some((note) => note.room === room.id));

  it('leave the dungeon as it is when there are none', () => {
    expect(applyDungeonEdits(model, NO_EDITS)).toBe(model);
  });

  it('change a note’s text and keep where its box was dragged', () => {
    const first = model.notes[0]!;
    const edited = applyDungeonEdits(model, withNoteEdit(NO_EDITS, first.room, { text: 'A sleeping ogre.', manual: { x: 2, y: 3 } }));
    expect(edited.notes.find((note) => note.room === first.room)).toEqual({ ref: first.ref, room: first.room, text: 'A sleeping ogre.', manual: { x: 2, y: 3 } });
  });

  it('number the notes again by the way in when one is added or deleted', () => {
    expect(unnoted).toBeDefined();
    const added = applyDungeonEdits(model, withNoteEdit(NO_EDITS, unnoted!.id, { text: 'Bats.' }));
    expect(added.notes).toHaveLength(model.notes.length + 1);
    const order = roomsByDistance(model.rooms, model.doors);
    const ranks = added.notes.map((note) => order.indexOf(note.room));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(added.notes.map((note) => note.ref)).toEqual(added.notes.map((_, index) => String(index + 1)));

    const deleted = applyDungeonEdits(model, withNoteEdit(NO_EDITS, model.notes[0]!.room, { deleted: true }));
    expect(deleted.notes).toHaveLength(model.notes.length - 1);
    expect(deleted.notes[0]!.ref).toBe('1');
  });

  it('replace the title and the story', () => {
    const edited = applyDungeonEdits(model, { ...NO_EDITS, title: 'The Pit', story: 'Told otherwise.' });
    expect(edited.title).toBe('The Pit');
    expect(edited.story).toBe('Told otherwise.');
    expect(edited.rooms).toBe(model.rooms);
  });

  it('keep dragged boxes and drop typed words when the notes are worded anew', () => {
    const [first, second] = model.notes;
    let edits = withNoteEdit(NO_EDITS, first!.room, { text: 'Typed.', manual: { x: 1, y: 1 } });
    edits = withNoteEdit(edits, second!.room, { text: 'Also typed.' });
    edits = { ...edits, title: 'Kept' };
    expect(withoutNoteTexts(edits)).toEqual({ title: 'Kept', notes: { [first!.room]: { manual: { x: 1, y: 1 } } } });
  });
});

describe('words the notes anew', () => {
  it('rewords the notes and leaves rooms and doors where they were', () => {
    const request = { seed: 4242, tags: ['medium'] };
    const first = generateDungeon(request, dungeonText);
    const again = generateDungeon({ ...request, notesVariant: 1 }, dungeonText);
    expect(again.rooms).toEqual(first.rooms);
    expect(again.doors).toEqual(first.doors);
    expect(again.title).toBe(first.title);
    expect(again.story).toBe(first.story);
    expect(again.notes.map((note) => note.room)).toEqual(first.notes.map((note) => note.room));
    expect(again.notes.map((note) => note.text)).not.toEqual(first.notes.map((note) => note.text));
    expect(generateDungeon({ ...request, notesVariant: 0 }, dungeonText)).toEqual(first);
  });
});

describe('hiding one secret wing', () => {
  const wingsOf = (m: ReturnType<typeof generateDungeon>): number[] => [...new Set(m.rooms.flatMap((room) => secretWingOf(m.rooms, room.id) ?? []))];
  const seed = Array.from({ length: 400 }, (_, i) => i + 1).find((s) => wingsOf(generateDungeon({ seed: s, tags: ['secret'] }, dungeonText)).length >= 2)!;
  const model = generateDungeon({ seed, tags: ['secret'] }, dungeonText);
  const [hiddenWing, keptWing] = wingsOf(model);

  it('names each wing by its first room, behind the secret door', () => {
    for (const wing of wingsOf(model)) {
      expect(model.doors.some((door) => door.to === wing && door.kind === 'secret')).toBe(true);
    }
    expect(secretWingOf(model.rooms, model.rooms[0]!.id)).toBeNull();
  });

  it('takes that wing out of the view, the note and the pins, and leaves the other', () => {
    const edited = applyDungeonEdits(model, withWingHidden(NO_EDITS, hiddenWing!));
    expect(edited.hiddenWings).toEqual([hiddenWing]);
    const shown = visibleDungeon(edited, DEFAULT_VIEW).rooms;
    const inWing = (room: { id: number }, wing: number): boolean => secretWingOf(model.rooms, room.id) === wing;
    expect(shown.some((room) => inWing(room, hiddenWing!))).toBe(false);
    expect(shown.some((room) => inWing(room, keptWing!))).toBe(true);
    expect(visibleDungeon(edited, DEFAULT_VIEW).doors.some((door) => door.to === hiddenWing)).toBe(false);
    const hiddenRooms = new Set(model.rooms.filter((room) => inWing(room, hiddenWing!)).map((room) => room.id));
    expect(shownNotes(edited, DEFAULT_VIEW).some((note) => hiddenRooms.has(note.room))).toBe(false);
    for (const note of model.notes.filter((n) => hiddenRooms.has(n.room))) expect(dungeonNoteText(edited, DEFAULT_VIEW)).not.toContain(note.text);
    const placement = { originCell: { x: 0, y: 0 }, pxPerCell: 100 };
    const pins = Object.values(dungeonPins(edited, DEFAULT_VIEW, placement, 'Dungeon.md'));
    expect(pins).toHaveLength(shownNotes(edited, DEFAULT_VIEW).length);
    const walls = (m: typeof model): number => Object.keys(dungeonWalls(m, STYLE_PRESETS.parchment, DEFAULT_VIEW, placement).walls).length;
    expect(walls(edited)).toBeLessThan(walls(model));
  });

  it('hides every wing when the view hides secret rooms, whatever was hidden by hand', () => {
    const edited = applyDungeonEdits(model, withWingHidden(NO_EDITS, hiddenWing!));
    expect(visibleDungeon(edited, { secrets: false }).rooms.some((room) => room.wing === 'secret')).toBe(false);
  });
});
