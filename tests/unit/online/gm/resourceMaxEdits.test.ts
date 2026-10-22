import { describe, expect, it } from 'vitest';
import { sheetOf } from '../../../../src/app/online/gm/book/bookSheet.ts';
import type { BookScene } from '../../../../src/app/online/gm/book/bookScene.ts';
import type { PlayedCharacter } from '../../../../src/app/online/gm/book/characters.ts';
import { checkMaxFieldEdit } from '../../../../src/app/online/gm/book/fieldEdit.ts';
import { checkResourceEdit } from '../../../../src/app/online/gm/book/resourceEdit.ts';
import { heldMaxRoute } from '../../../../src/app/online/gm/book/resourceMax.ts';
import { ResourceWrites, type TokenResourceEdit } from '../../../../src/app/online/gm/book/resourceWrites.ts';
import { statblockSheet } from '../../../../src/app/online/gm/book/statblockSheet.ts';
import { storedRead } from '../../../../src/app/online/gm/book/statblockSheets.ts';
import { trackedSheetValues } from '../../../../src/app/online/gm/book/trackedSheet.ts';
import type { BookResourceMessage } from '../../../../src/app/online/protocol/index.ts';
import type { ResourceDefinition } from '../../../../src/app/resources/resourceTypes';
import { runUntracked } from '../../../../src/app/stores/history';
import type { StatblockTemplate, TemplateField } from '../../../../src/app/statblocks/model/templateTypes';
import { applyFrontmatterPatches } from '../../../../src/app/statblocks/notes/frontmatterPatch';
import { templateOf } from '../../statblocks/render/sheetTestKit';
import { resolvedOf } from './statblockSheet/sheetKit';
import { ANA, BEN, STORE_FACTORY, table as realTable, type StoreFactory } from './realStore.ts';
import { token } from './shareHarness.ts';
import { propertiesOf } from './statblockNotes.ts';

const { createViewAtlasStore } = (await import(/* @vite-ignore */ STORE_FACTORY)) as { createViewAtlasStore: StoreFactory };

const HP: ResourceDefinition = { key: 'hp', name: 'Hit Points', field: 'hp', direction: 'drains', color: '#cc3333', visibleToPlayers: true };
const FIELDS: TemplateField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'hp', label: 'HP', type: 'number' },
  // Daggerheart's armour: the field is its own maximum, its marked slots are kept like a resource's
  { key: 'armor', label: 'Armor', type: 'number', tracks: { counts: 'up' } },
  { key: 'level', label: 'Level', type: 'number' },
  { key: 'ki', label: 'Ki', type: 'number', tracks: { counts: 'down', max: 'kimax' } },
  { key: 'kimax', label: 'Ki max', type: 'number' },
];
const TEMPLATE: StatblockTemplate = templateOf(FIELDS, [{ id: 'metric01', type: 'metric', fields: ['armor', 'ki'] }]);
const NOTE = { name: 'Ana', hp: 10, armor: 3, level: 2, ki: 2, kimax: '4' };
const RESOLVED = resolvedOf(TEMPLATE, NOTE);
const PATH = 'Characters/Ana.md';
const LINKED = token('ana', { kind: 'character', statblockPath: PATH, resources: { hp: { current: 6, max: 10 }, armor: { current: 2, max: 3 } } } as never);

const sheetFor = (resolved = RESOLVED, held = LINKED): PlayedCharacter['sheet'] =>
  sheetOf({ name: 'Ana', imagePath: 'ana.png', showRing: false } as never, held, [HP], () => null, trackedSheetValues(resolved, [HP], held.resources), (definition) => heldMaxRoute(resolved, definition, held, PATH) !== null)!;

const ana = (sheet = sheetFor()): PlayedCharacter => ({
  collection: 'c', key: 'lib-ana', imagePath: 'ana.png', tokenId: 'ana', placed: { assetId: 'lib-ana', imagePath: 'ana.png' }, sheet, statblockPath: PATH, drawnWith: { definitions: [HP], resources: LINKED.resources },
});
const sceneOf = (held = LINKED): BookScene => ({ mapPath: 'map', collection: 'c', resources: [HP], tokens: { ana: held }, shown: () => new Map(), listedToken: () => undefined });
const message = (key: string, current: number, max: number): BookResourceMessage => ({ t: 'book-resource', key, current, max });

describe('which maximums a player may set', () => {
  it('a tracked number\'s and a resource\'s that follows the note, where the note holds a plain number of a field the player may change', () => {
    const sheet = sheetFor();
    expect(sheet.resources.map(({ key, maxEditable }) => [key, maxEditable])).toEqual([['hp', true], ['armor', true], ['ki', true]]);
  });

  it('never one a formula works out, or a field the player may only read', () => {
    const worked = { ...resolvedOf(TEMPLATE, { ...NOTE, hp: '@level * 5', kimax: '@level' }), shownFields: { ...NOTE, hp: 10, kimax: 2 } };
    expect(sheetFor(worked).resources.map(({ key, maxEditable }) => [key, maxEditable])).toEqual([['hp', false], ['armor', true], ['ki', false]]);
    const readOnly = resolvedOf({ ...TEMPLATE, players: { armor: 'read', hp: 'read' } }, NOTE);
    expect(sheetFor(readOnly).resources.map(({ key, maxEditable }) => [key, maxEditable])).toEqual([['hp', false], ['armor', false], ['ki', true]]);
  });

  it('by hand where the token follows no note: not linked, or its maximum set by hand already', () => {
    expect(heldMaxRoute(RESOLVED, HP, { ...LINKED, statblockPath: undefined }, PATH)).toEqual({ kind: 'hand' });
    expect(heldMaxRoute(RESOLVED, HP, { ...LINKED, overriddenMax: ['hp'] }, PATH)).toEqual({ kind: 'hand' });
    expect(heldMaxRoute(RESOLVED, HP, LINKED, PATH)).toEqual({ kind: 'note', field: 'hp' });
    expect(heldMaxRoute(undefined, HP, LINKED, PATH)).toBeNull();
  });
});

describe('a player\'s maximum, checked', () => {
  it('goes to the note\'s field for a tracked number and a resource that follows it', () => {
    expect(checkResourceEdit(ANA, ana(), sceneOf(), () => ANA, message('armor', 2, 5), RESOLVED))
      .toMatchObject({ kind: 'token', key: 'armor', max: { value: 5, route: { kind: 'note', field: 'armor' } } });
    expect(checkResourceEdit(ANA, ana(), sceneOf(), () => ANA, message('ki', 2, 6), RESOLVED)).toMatchObject({ max: { route: { kind: 'note', field: 'kimax' } } });
    expect(checkResourceEdit(ANA, ana(), sceneOf(), () => ANA, message('hp', 6, 12), RESOLVED)).toMatchObject({ max: { route: { kind: 'note', field: 'hp' } } });
  });

  it('is refused for another player\'s character, a maximum the sheet does not offer, and a counting maximum of 0', () => {
    expect(checkResourceEdit(BEN, ana(), sceneOf(), () => ANA, message('hp', 6, 12), RESOLVED)).toBeNull();
    const worked = resolvedOf(TEMPLATE, { ...NOTE, kimax: '@level' });
    expect(checkResourceEdit(ANA, ana(sheetFor(worked)), sceneOf(), () => ANA, message('ki', 2, 6), worked)).toBeNull();
    // The sheet offered it, but the note took a formula since
    expect(checkResourceEdit(ANA, ana(), sceneOf(), () => ANA, message('ki', 2, 6), worked)).toBeNull();
    expect(checkResourceEdit(ANA, ana(), sceneOf(), () => ANA, message('hp', 0, 0), RESOLVED)).toBeNull();
  });

  it('is the campaign\'s by hand for a resource of a character no scene shows, and still the note\'s for a tracked number', () => {
    expect(checkResourceEdit(ANA, ana(), null, () => ANA, message('hp', 6, 12), RESOLVED)).toMatchObject({ kind: 'character', max: { value: 12, route: { kind: 'hand' } } });
    expect(checkResourceEdit(ANA, ana(), null, () => ANA, message('armor', 1, 4), RESOLVED)).toMatchObject({ kind: 'character', max: { route: { kind: 'note', field: 'armor' } } });
  });

  it('writes the note\'s number field, which the player\'s sheet then reads its maximum from', () => {
    const text = '---\nstatblock: true\natlas-template: test-template-abc123\nname: Ana\narmor: 3\nkimax: "4"\n---\n';
    const fields = propertiesOf(text) ?? {};
    const resolved = resolvedOf(TEMPLATE, fields);
    const inputs = { resolved, sent: statblockSheet({ resolved, definitions: [HP], resources: undefined }), read: (field: Parameters<typeof storedRead>[1]) => storedRead(fields, field) };
    const armor = checkMaxFieldEdit(inputs, 'armor', 5);
    const ki = checkMaxFieldEdit(inputs, 'kimax', 6);
    const written = applyFrontmatterPatches(text, [...(armor?.patches ?? []), ...(ki?.patches ?? [])]);
    expect(written.conflicts).toEqual([]);
    const after = propertiesOf(written.text) ?? {};
    expect(after).toMatchObject({ armor: 5, kimax: 6 });
    // Marked slots above the new maximum read within it
    expect(trackedSheetValues(resolvedOf(TEMPLATE, after), [HP], { armor: { current: 4, max: 3 } }).map(({ value }) => value)).toEqual([{ current: 4, max: 5 }, { current: 6, max: 6 }]);
    expect(checkMaxFieldEdit({ ...inputs, sent: null }, 'armor', 5)).toBeNull();
    expect(checkMaxFieldEdit(inputs, 'name', 5)).toBeNull();
  });
});

describe('a maximum on the real Atlas store', () => {
  function writes(): ReturnType<typeof realTable> & { readonly resources: ResourceWrites; readonly answers: unknown[] } {
    const real = realTable(createViewAtlasStore);
    runUntracked(real.store, () => real.store.setState((draft) => {
      const held = draft.objects.tokens.ogre;
      if (held !== undefined) held.resources = { hp: { current: 7, max: 12 } };
    }));
    const resources = new ResourceWrites(real.store, {
      definitions: () => [HP], ownerOf: (tokenId) => (tokenId === 'ogre' ? ANA : BEN),
      now: () => Date.now(), setTimer: (run, ms) => setTimeout(run, ms) as unknown as number, clearTimer: (timer) => clearTimeout(timer),
    });
    resources.start();
    return { ...real, resources, answers: [] };
  }
  const edit = (current: number, max: number, kind: 'hand' | 'note'): TokenResourceEdit => ({
    kind: 'token', from: ANA, tokenId: 'ogre', key: 'hp', current, max: { value: max, route: kind === 'hand' ? { kind } : { kind, field: 'hp' }, fixed: false },
  });

  it('sets it by hand as one step of the GM\'s, the current value clamped to it', () => {
    const { store, history, resources, answers } = writes();
    resources.write(edit(7, 4, 'hand'), (taken, max) => answers.push([taken, max]));
    expect(store.getState().objects.tokens.ogre).toMatchObject({ resources: { hp: { current: 4, max: 4 } }, overriddenMax: ['hp'] });
    expect(history.getState().pastStates).toHaveLength(1);
    expect(answers).toEqual([[4, 4]]);
  });

  it('gives the token a maximum its note gives without making it its own', () => {
    const { store, resources } = writes();
    resources.write(edit(7, 20, 'note'), () => undefined);
    expect(store.getState().objects.tokens.ogre?.resources?.hp).toEqual({ current: 7, max: 20 });
    expect(store.getState().objects.tokens.ogre?.overriddenMax).toBeUndefined();
  });
});
