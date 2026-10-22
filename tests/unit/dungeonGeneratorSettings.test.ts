// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { applyDungeonEdits, NO_EDITS, withWingHidden } from '../../src/app/dungeons/edits';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { dungeonWalls } from '../../src/app/dungeons/scene/toWalls';
import { secretWingOf } from '../../src/app/dungeons/secretWings';
import { generateDungeon } from '../../src/app/dungeons/generate';
import { DEFAULT_DUNGEON_GENERATOR_SETTINGS, readDungeonGeneratorSettings } from '../../src/app/dungeons/generatorSettings';
import { DEFAULT_VIEW, STYLE_LIMITS, STYLE_PRESETS } from '../../src/app/dungeons/style';
import { paletteFileText, readDungeonStyle, readPaletteFile } from '../../src/app/dungeons/styleJson';
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
      style: { colors: { ink: 'red', paper: '#ABCDEF' }, strokes: { thick: 99 }, hatching: { mode: 'wavy', strokes: 3.6 } },
      view: { grid: 'hexes', water: false, notes: 'boxes', titleAndStory: true, rotateToFit: false },
      tags: ['small', 'large', 'unknown', 7],
    });
    expect(read.preset).toBe('custom');
    expect(read.style.colors.ink).toBe(STYLE_PRESETS.parchment.colors.ink);
    expect(read.style.colors.paper).toBe('#abcdef');
    expect(read.style.strokes.thick).toBe(STYLE_LIMITS.strokeThick[1]);
    expect(read.style.hatching).toMatchObject({ mode: 'hatching', strokes: 4 });
    // Fields of the page the generator once drew are left behind
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

  it('reads a palette saved with fonts, leaving them out', () => {
    const old = JSON.stringify({ format: 'atlas-dungeon-palette', version: 1, style: { ...STYLE_PRESETS.slate, fonts: { title: { face: 'title', size: 48 } } } });
    expect(readPaletteFile(old)).toEqual(STYLE_PRESETS.slate);
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
  it('leave the dungeon as it is when there are none', () => {
    const model = generateDungeon({ seed: 4242, tags: ['medium'] });
    expect(applyDungeonEdits(model, NO_EDITS)).toBe(model);
  });
});

describe('hiding one secret wing', () => {
  const wingsOf = (m: ReturnType<typeof generateDungeon>): number[] => [...new Set(m.rooms.flatMap((room) => secretWingOf(m.rooms, room.id) ?? []))];
  const seed = Array.from({ length: 400 }, (_, i) => i + 1).find((s) => wingsOf(generateDungeon({ seed: s, tags: ['secret'] })).length >= 2)!;
  const model = generateDungeon({ seed, tags: ['secret'] });
  const [hiddenWing, keptWing] = wingsOf(model);

  it('names each wing by its first room, behind the secret door', () => {
    for (const wing of wingsOf(model)) {
      expect(model.doors.some((door) => door.to === wing && door.kind === 'secret')).toBe(true);
    }
    expect(secretWingOf(model.rooms, model.rooms[0]!.id)).toBeNull();
  });

  it('takes that wing out of the view and the walls, and leaves the other', () => {
    const edited = applyDungeonEdits(model, withWingHidden(NO_EDITS, hiddenWing!));
    expect(edited.hiddenWings).toEqual([hiddenWing]);
    const shown = visibleDungeon(edited, DEFAULT_VIEW).rooms;
    const inWing = (room: { id: number }, wing: number): boolean => secretWingOf(model.rooms, room.id) === wing;
    expect(shown.some((room) => inWing(room, hiddenWing!))).toBe(false);
    expect(shown.some((room) => inWing(room, keptWing!))).toBe(true);
    expect(visibleDungeon(edited, DEFAULT_VIEW).doors.some((door) => door.to === hiddenWing)).toBe(false);
    const placement = { originCell: { x: 0, y: 0 }, pxPerCell: 100 };
    const walls = (m: typeof model): number => Object.keys(dungeonWalls(m, STYLE_PRESETS.parchment, DEFAULT_VIEW, placement).walls).length;
    expect(walls(edited)).toBeLessThan(walls(model));
  });

  it('hides every wing when the view hides secret rooms, whatever was hidden by hand', () => {
    const edited = applyDungeonEdits(model, withWingHidden(NO_EDITS, hiddenWing!));
    expect(visibleDungeon(edited, { secrets: false }).rooms.some((room) => room.wing === 'secret')).toBe(false);
  });
});
