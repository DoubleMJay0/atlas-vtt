// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { dungeonShortcutOf, keyBelongsToControl, type ShortcutKey } from '../../src/app/packages/components/dungeon-generator/dungeonShortcuts';
import { nextNotesMode, raisedWaterLevel } from '../../src/app/packages/components/dungeon-generator/shortcutActions';

const press = (key: string, code: string, modifiers: Partial<ShortcutKey> = {}): ShortcutKey => ({ key, code, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...modifiers });

describe('the generator’s keys', () => {
  it.each([
    [press('Enter', 'Enter'), { kind: 'new' }],
    [press(' ', 'Space'), { kind: 'rearrange' }],
    [press(' ', 'Space', { shiftKey: true }), { kind: 'rerollNotes' }],
    [press('n', 'KeyN'), { kind: 'cycleNotes' }],
    [press('G', 'KeyG', { shiftKey: true }), { kind: 'gridStyle' }],
    [press('3', 'Digit3'), { kind: 'preset', index: 2 }],
    [press('!', 'Digit1', { shiftKey: true }), { kind: 'smallTiles', on: false }],
    [press('@', 'Digit2', { shiftKey: true }), { kind: 'smallTiles', on: true }],
    [press('E', 'KeyE', { shiftKey: true }), { kind: 'exportMap' }],
  ])('%o asks for %o', (key, expected) => {
    expect(dungeonShortcutOf(key)).toEqual(expected);
  });

  it('leaves presses with Mod, Ctrl or Alt and unknown keys to others', () => {
    expect(dungeonShortcutOf(press('s', 'KeyS', { metaKey: true }))).toBeNull();
    expect(dungeonShortcutOf(press('n', 'KeyN', { altKey: true }))).toBeNull();
    expect(dungeonShortcutOf(press('q', 'KeyQ'))).toBeNull();
  });

  it('leaves typing and a focused button’s own keys alone', () => {
    const input = document.createElement('input');
    const button = document.createElement('button');
    expect(keyBelongsToControl(input, 'n')).toBe(true);
    expect(keyBelongsToControl(button, 'Enter')).toBe(true);
    expect(keyBelongsToControl(button, 'n')).toBe(false);
  });

  it('steps the notes modes and the water level as the generator GMs know does', () => {
    expect(['boxes', 'tailed', 'legend', 'off'].map((mode) => nextNotesMode(mode as never))).toEqual(['tailed', 'legend', 'off', 'boxes']);
    expect(nextNotesMode('symbols')).toBe('boxes');
    expect(raisedWaterLevel(undefined)).toBe(0.1);
    expect(raisedWaterLevel(0.9)).toBe(1);
    expect(raisedWaterLevel(1)).toBe(0);
  });
});
