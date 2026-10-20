import { describe, expect, it } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import type { TokenEntity } from '../../src/app/types';
import type { InitiativeRules } from '../../src/app/types/initiativeRulesTypes';
import { createInMemoryApp } from '../mocks/inMemoryVault';

type Store = ReturnType<typeof createViewAtlasStore>;

const SIDES: InitiativeRules = { mode: 'sides', roll: '1d20', firstSide: 'players' };

/** A fight between `names` in that order; tokens that see fight on the players' side. */
function fight(names: string[], players: string[] = []): Store {
  const { app } = createInMemoryApp();
  const store = createViewAtlasStore(app, `turn-skips-${Math.random()}`);
  store.setState({ persistenceEnabled: false });
  const tokens: Record<string, TokenEntity> = {};
  for (const name of names) {
    tokens[name] = { id: name, kind: 'token', x: 0, y: 0, imagePath: '', ...(players.includes(name) ? { vision: { enabled: true } } : {}) } as TokenEntity;
    store.getState().addToInitiative({ tokenId: name, name, initiative: 0, initiativeModifier: 0, imagePath: '', isNPC: true });
  }
  store.setState((state) => ({ objects: { ...state.objects, tokens } }));
  return store;
}

const idOf = (store: Store, name: string): string => store.getState().initiative.entries.find((entry) => entry.name === name)!.id;
const ids = (store: Store, ...names: string[]): Set<string> => new Set(names.map((name) => idOf(store, name)));
/** The round and the combatant with the turn. */
const turn = (store: Store): [number, string | undefined] =>
  [store.getState().initiative.round, store.getState().initiative.entries.find((entry) => entry.isActive)?.name];
const sideTurn = (store: Store): [number, string | undefined] => [store.getState().initiative.round, store.getState().initiative.sides?.active];
const sittingOut = (store: Store): string[] => store.getState().initiative.entries.filter((entry) => entry.sitsOut).map((entry) => entry.name);

describe('defeated combatants in turn order', () => {
  it('are passed by, and a round still begins after the last one that acts', () => {
    const store = fight(['a', 'b', 'c', 'd']);
    const defeated = ids(store, 'b', 'd');
    store.getState().startCombat(undefined, defeated);
    const seen = [turn(store)];
    for (let step = 0; step < 3; step++) { store.getState().nextTurn(defeated); seen.push(turn(store)); }
    expect(seen).toEqual([[1, 'a'], [1, 'c'], [2, 'a'], [2, 'c']]);
  });

  it('are passed by stepping back, into the round before', () => {
    const store = fight(['a', 'b', 'c']);
    const defeated = ids(store, 'c');
    store.getState().startCombat();
    store.getState().nextTurn(defeated);
    store.getState().nextTurn(defeated);
    expect(turn(store)).toEqual([2, 'a']);
    store.getState().previousTurn(defeated);
    expect(turn(store)).toEqual([1, 'b']);
    store.getState().previousTurn(defeated);
    expect(turn(store)).toEqual([1, 'a']);
  });

  it('never take the turn when the fight starts', () => {
    const store = fight(['a', 'b']);
    store.getState().startCombat(undefined, ids(store, 'a'));
    expect(turn(store)).toEqual([1, 'b']);
  });

  it('leave the turn where it is when nobody can act', () => {
    const store = fight(['a', 'b']);
    store.getState().startCombat();
    const everyone = ids(store, 'a', 'b');
    store.getState().nextTurn(everyone);
    store.getState().previousTurn(everyone);
    expect(turn(store)).toEqual([1, 'a']);
  });
});

describe('sitting a round out in turn order', () => {
  it('is passed by for the round, and the next round clears it', () => {
    const store = fight(['a', 'b', 'c']);
    store.getState().startCombat();
    store.getState().setInitiativeSitsOut(idOf(store, 'b'), true);
    store.getState().nextTurn();
    expect(turn(store)).toEqual([1, 'c']);
    store.getState().nextTurn();
    expect(turn(store)).toEqual([2, 'a']);
    expect(sittingOut(store)).toEqual([]);
    store.getState().nextTurn();
    expect(turn(store)).toEqual([2, 'b']);
  });

  it('comes back when the turn steps back over the start of the round', () => {
    const store = fight(['a', 'b', 'c']);
    store.getState().startCombat();
    store.getState().setInitiativeSitsOut(idOf(store, 'c'), true);
    store.getState().nextTurn();
    store.getState().nextTurn();
    expect(turn(store)).toEqual([2, 'a']);
    store.getState().previousTurn();
    expect(turn(store)).toEqual([1, 'b']);
    expect(sittingOut(store)).toEqual(['c']);
    expect(store.getState().initiative).not.toHaveProperty('satOut');
  });
});

describe('a fight by sides', () => {
  it('passes by a side whose combatants are all defeated or sit out, and gives an empty side its turn', () => {
    const store = fight(['hero', 'goblin', 'rat'], ['hero']);
    store.getState().startCombat(SIDES);
    const defeated = ids(store, 'goblin');
    store.getState().setInitiativeSitsOut(idOf(store, 'rat'), true);
    store.getState().nextTurn(defeated);
    // The opponents' turn passed by: a new round, which clears the rat's mark
    expect(sideTurn(store)).toEqual([2, 'players']);
    store.getState().nextTurn(defeated);
    expect(sideTurn(store)).toEqual([2, 'opponents']);

    const alone = fight(['goblin']);
    alone.getState().startCombat(SIDES);
    alone.getState().nextTurn();
    alone.getState().nextTurn();
    expect(sideTurn(alone)).toEqual([2, 'players']);
  });

  it('brings back the marks a new round cleared when the turn steps back over it', () => {
    const store = fight(['hero', 'cleric', 'goblin'], ['hero', 'cleric']);
    store.getState().startCombat(SIDES);
    store.getState().setInitiativeSitsOut(idOf(store, 'cleric'), true);
    store.getState().nextTurn();
    store.getState().nextTurn();
    expect(sideTurn(store)).toEqual([2, 'players']);
    expect(sittingOut(store)).toEqual([]);

    // A mark set in round 2 belongs to round 2
    store.getState().setInitiativeSitsOut(idOf(store, 'hero'), true);
    store.getState().previousTurn();
    expect(sideTurn(store)).toEqual([1, 'opponents']);
    expect(sittingOut(store)).toEqual(['cleric']);
    store.getState().nextTurn();
    expect(sideTurn(store)).toEqual([2, 'players']);
    expect(sittingOut(store)).toEqual([]);
  });

  it('steps back past a side nobody of acts in', () => {
    const store = fight(['hero', 'goblin'], ['hero']);
    store.getState().startCombat(SIDES);
    store.getState().nextTurn();
    store.getState().nextTurn();
    expect(sideTurn(store)).toEqual([2, 'players']);
    store.getState().previousTurn(ids(store, 'goblin'));
    expect(sideTurn(store)).toEqual([1, 'players']);
  });
});

describe('delaying a turn', () => {
  it('passes the turn on, waits outside the order, and acts before the combatant whose turn it is', () => {
    const store = fight(['a', 'b', 'c']);
    store.getState().setInitiativeConfig({ autoSort: false });
    store.getState().updateInitiativeEntry(idOf(store, 'b'), { initiative: 12 });
    store.getState().startCombat();
    expect(turn(store)).toEqual([1, 'a']);
    store.getState().delayInitiativeTurn(idOf(store, 'a'));
    expect(turn(store)).toEqual([1, 'b']);
    store.getState().nextTurn();
    expect(turn(store)).toEqual([1, 'c']);
    store.getState().nextTurn();
    // The delayed combatant is passed by in the next round too
    expect(turn(store)).toEqual([2, 'b']);

    store.getState().actNowInInitiative(idOf(store, 'a'));
    const { entries } = store.getState().initiative;
    expect(entries.map((entry) => [entry.name, entry.order, entry.isActive])).toEqual([['a', 0, true], ['b', 1, false], ['c', 2, false]]);
    expect(entries[0]).toMatchObject({ initiative: 12 });
    expect(entries[0]).not.toHaveProperty('delayed');
    store.getState().nextTurn();
    expect(turn(store)).toEqual([2, 'b']);
  });

  it('keeps the turn where it is when another combatant delays, and ends with the fight', () => {
    const store = fight(['a', 'b', 'c']);
    store.getState().startCombat();
    store.getState().delayInitiativeTurn(idOf(store, 'c'));
    expect(turn(store)).toEqual([1, 'a']);
    store.getState().nextTurn();
    store.getState().nextTurn();
    expect(turn(store)).toEqual([2, 'a']);
    store.getState().endCombat();
    expect(store.getState().initiative.entries.some((entry) => entry.delayed)).toBe(false);
  });
});
