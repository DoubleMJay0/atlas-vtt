import { describe, expect, it, vi } from 'vitest';

const pixi = vi.hoisted(() => ({ panToToken: vi.fn(), addTokenHighlight: vi.fn() }));
vi.mock('../../src/app/pixi/tokenFocus', () => ({ panToToken: pixi.panToToken }));
vi.mock('../../src/app/pixi/utils/tokenHighlight', () => ({ addTokenHighlight: pixi.addTokenHighlight }));

import { cardClickSelection, focusCombatant } from '../../src/app/initiative/focusCombatant';
import { cardInstanceNumber } from '../../src/app/initiative/cardInstanceNumber';
import type { TokenEntity } from '../../src/app/types';
import type { AtlasView } from '../../src/app/atlas-view';

const token = (id: string, imagePath: string, instanceNumber?: number): TokenEntity =>
  ({ id, kind: 'token', x: 10, y: 20, imagePath, ...(instanceNumber !== undefined ? { instanceNumber } : {}) }) as TokenEntity;

describe('the selection a click on a card makes', () => {
  it('is the token alone, as a click on the map', () => {
    expect(cardClickSelection(['a', 'b'], 'c', false)).toEqual(['c']);
  });

  it('adds the token with Shift, and takes it out where it was in', () => {
    expect(cardClickSelection(['a'], 'c', true)).toEqual(['a', 'c']);
    expect(cardClickSelection(['a', 'c'], 'c', true)).toEqual(['a']);
  });
});

describe('focusCombatant', () => {
  it('selects the token, brings it into view at the grid of the scene and lets it glow', () => {
    const viewport = {};
    const view = { renderer: { getViewportInstance: () => viewport } } as unknown as AtlasView;
    const setSelection = vi.fn();
    const goblin = token('goblin', 'g.png');

    focusCombatant(view, { objects: { tokens: { goblin } }, selectedIds: [], setSelection, grid: { size: 50 } } as never, 'goblin', false);

    expect(setSelection).toHaveBeenCalledWith(['goblin']);
    expect(pixi.panToToken).toHaveBeenCalledWith(viewport, goblin, 50);
    expect(pixi.addTokenHighlight).toHaveBeenCalledWith(view, 'goblin');
  });

  it('does nothing for a combatant whose token is gone', () => {
    const setSelection = vi.fn();
    focusCombatant(null, { objects: { tokens: {} }, selectedIds: ['a'], setSelection, grid: { size: 70 } } as never, 'gone', false);
    expect(setSelection).not.toHaveBeenCalled();
  });
});

describe("the number on a GM's card", () => {
  it("is the number the token's badge shows on the map: 1 where the token has none of its own", () => {
    const tokens = { a: token('a', 'goblin.png'), b: token('b', 'goblin.png', 2), c: token('c', 'orc.png', 1) };
    expect(cardInstanceNumber(tokens, 'a', true)).toBe(1);
    expect(cardInstanceNumber(tokens, 'b', true)).toBe(2);
  });

  it('is none for a token without look-alikes, or while badges are off', () => {
    const tokens = { a: token('a', 'goblin.png', 1), b: token('b', 'goblin.png', 2), c: token('c', 'orc.png', 3) };
    expect(cardInstanceNumber(tokens, 'c', true)).toBeNull();
    expect(cardInstanceNumber(tokens, 'a', false)).toBeNull();
    expect(cardInstanceNumber(tokens, 'gone', true)).toBeNull();
  });
});
