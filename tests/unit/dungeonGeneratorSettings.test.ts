// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { applyDungeonEdits, NO_EDITS, withNoteEdit, withoutManualPlaces } from '../../src/app/dungeons/edits';
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

  it('replace the story, and forget dragged boxes on Rearrange', () => {
    const room = model.notes[0]!.room;
    const edits = { ...withNoteEdit(NO_EDITS, room, { manual: { x: 1, y: 1 } }), story: 'Told otherwise.' };
    expect(applyDungeonEdits(model, edits).story).toBe('Told otherwise.');
    expect(withoutManualPlaces(edits).notes).toEqual({});
  });
});
