// @vitest-environment node
import type { PlayerDrag, PlayerMove } from '../../../../src/app/online/protocol/index.ts';
import { moveWallsOf, type MoveWalls } from '../../../../src/app/online/movement/index.ts';
import { describe, expect, it } from 'vitest';
import { runUntracked } from '../../../../src/app/stores/history';
import type { LevelLink, SceneLevel } from '../../../../src/app/types/sceneLevelTypes';
import { ALIAS, ANA, SCENE, STORE_FACTORY, table as realTable, type StoreFactory, type Table } from './realStore.ts';

const { createViewAtlasStore } = (await import(/* @vite-ignore */ STORE_FACTORY)) as { createViewAtlasStore: StoreFactory };

const LEVELS: SceneLevel[] = [
  { id: 'ground', name: 'Ground', elevation: { bottom: 0, top: 10 }, background: null },
  { id: 'upper', name: 'Upper', elevation: { bottom: 10, top: 20 }, background: null },
];
/** Cells of 100 px: stairs two wide and three long from x 400 to 600 and y 400 to 700, the foot at the bottom, walked up northwards. */
const STAIRS: LevelLink = {
  id: 'stairs',
  kind: 'level-link',
  polygon: [{ x: 400, y: 400 }, { x: 600, y: 400 }, { x: 600, y: 700 }, { x: 400, y: 700 }],
  levels: ['ground', 'upper'],
  flight: { foot: 2, rows: 3 },
};

/** A table whose scene has two levels and the stairs, with the ogre at a place on a level; `walls` as the scene's. */
function table(x: number, y: number, level = 'ground', walls: () => MoveWalls | null = () => null): Table {
  const t = realTable(createViewAtlasStore, walls);
  runUntracked(t.store, () => t.store.setState((draft) => {
    (draft as unknown as { levels: SceneLevel[] }).levels = LEVELS;
    draft.objects.levelLinks = { stairs: STAIRS };
    Object.assign(draft.objects.tokens.ogre!, { x, y, level });
  }));
  return t;
}

const move = (x: number, y: number): PlayerMove => ({ t: 'move', scene: SCENE, id: ALIAS.ogre, x, y });
const drag = (x: number, y: number): PlayerDrag => ({ t: 'drag', scene: SCENE, id: ALIAS.ogre, x, y });
const ogre = (t: Table): { x: number; y: number; level?: string | undefined } => {
  const { x, y, level } = t.store.getState().objects.tokens.ogre!;
  return { x, y, level };
};
const refused = (t: Table): number => t.sent.filter(({ body }) => body.t === 'move-refused').length;

describe('a player\'s token on walked stairs', () => {
  it('steps on at the foot, climbs, and changes level in the last row, one undo step a move', () => {
    const t = table(450, 750);
    t.moves.receive(ANA, move(450, 650));
    expect(ogre(t)).toEqual({ x: 450, y: 650, level: 'ground' });
    t.moves.receive(ANA, move(450, 550));
    expect(ogre(t)).toEqual({ x: 450, y: 550, level: 'ground' });
    t.moves.receive(ANA, move(450, 450));
    expect(ogre(t)).toEqual({ x: 450, y: 450, level: 'upper' });
    expect(t.taken).toEqual([{ tokenId: 'ogre', level: 'upper' }]);
    expect(refused(t)).toBe(0);
    expect(t.history.getState().pastStates).toHaveLength(3);
  });

  it('arrives at the ground end upstairs, steps off there, and walks back down the same way', () => {
    const t = table(550, 450, 'upper');
    t.moves.receive(ANA, move(550, 350));
    expect(ogre(t)).toEqual({ x: 550, y: 350, level: 'upper' });
    t.moves.receive(ANA, move(550, 450));
    t.moves.receive(ANA, move(550, 550));
    expect(ogre(t)).toEqual({ x: 550, y: 550, level: 'upper' });
    t.moves.receive(ANA, move(550, 650));
    expect(ogre(t)).toEqual({ x: 550, y: 650, level: 'ground' });
    expect(refused(t)).toBe(0);
  });

  it('cannot step on from a side, on either level: it stops before it as before a wall, and its player hears where', () => {
    for (const level of ['ground', 'upper']) {
      const t = table(300, 550, level);
      t.moves.receive(ANA, move(450, 550));
      expect(ogre(t).x, level).toBeLessThan(400);
      expect(ogre(t).level, level).toBe(level);
      expect(refused(t), level).toBe(1);
    }
  });

  it('cannot step on from the head downstairs nor from the foot upstairs', () => {
    const down = table(450, 350, 'ground');
    down.moves.receive(ANA, move(450, 450));
    expect(ogre(down).y).toBeLessThan(400);
    expect(ogre(down).level).toBe('ground');
    const up = table(450, 750, 'upper');
    up.moves.receive(ANA, move(450, 650));
    expect(ogre(up).y).toBeGreaterThan(700);
    expect(ogre(up).level).toBe('upper');
  });

  it('cannot step off over a side either, where the GM put it on the stairs', () => {
    const t = table(450, 550);
    t.moves.receive(ANA, move(300, 550));
    expect(ogre(t).x).toBeGreaterThan(400);
  });

  it('stops at the scene\'s walls and the stairs\' sides alike on a lit scene', () => {
    const walls = moveWallsOf([[0, 900, 2000, 900]], 4);
    const t = table(300, 550, 'ground', () => walls);
    t.moves.receive(ANA, move(450, 550));
    expect(ogre(t).x).toBeLessThan(400);
    t.moves.receive(ANA, move(300, 1000));
    expect(ogre(t).y).toBeLessThan(900);
  });

  it('is dragged onto the stairs only at their foot, and changes level only when dropped in the last row', () => {
    const t = table(450, 750);
    t.moves.drag(ANA, drag(450, 650));
    t.moves.drag(ANA, drag(450, 450));
    expect(ogre(t)).toEqual({ x: 450, y: 450, level: 'ground' });
    t.moves.receive(ANA, move(450, 450));
    expect(ogre(t)).toEqual({ x: 450, y: 450, level: 'upper' });
    expect(t.taken).toEqual([{ tokenId: 'ogre', level: 'upper' }]);
    expect(t.history.getState().pastStates).toHaveLength(1);
  });

  it('is held at a side by a drag across it, and its drop leaves it there, on its level', () => {
    const t = table(300, 450);
    t.moves.drag(ANA, drag(450, 450));
    expect(ogre(t).x).toBeLessThan(400);
    t.moves.receive(ANA, move(450, 450));
    expect(ogre(t).x).toBeLessThan(400);
    expect(ogre(t).level).toBe('ground');
    expect(t.taken).toEqual([]);
  });
});
