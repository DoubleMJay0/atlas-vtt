/// <reference types="vite/client" />
import '../setup/obsidianDom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIGHTING_QUALITY } from '../../src/app/lighting/lightingQuality';
import { generatedDungeon, openDungeonView, TORCH, type DungeonView } from '../helpers/generatedDungeonView';

vi.mock('events', async () => import('eventemitter3'));

type ShownTile = { moving?: true };
type Tiles = { busy(): boolean; tiles(): ReadonlyMap<string, ShownTile> };

function tilesOf(ctx: DungeonView): Tiles {
  const host = ctx.view.controller.renderer as unknown as { view: { engine?: { world: { tiles: Tiles } | null } } };
  return host.view.engine!.world!.tiles;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('a carried light that was dragged', () => {
  let ctx: DungeonView | null = null;
  afterEach(() => { ctx?.destroy(); ctx = null; });

  it('is traced in full once its token rests, never keeping the quick tile of the drag', async () => {
    const built = generatedDungeon();
    ctx = await openDungeonView(built, { quality: LIGHTING_QUALITY.high, openings: true, pane: 720, paneHeight: 450, resolution: 1 });
    const { store } = ctx.view;
    const hero = store.getState().objects.tokens.hero!;
    store.getState().updateTokens([{ id: 'hero', changes: { light: TORCH } }]);
    for (let i = 0; i < 30; i++) { ctx.frame(); await wait(0); }

    for (let i = 1; i <= 10; i++) {
      store.getState().setTokenPositions([{ id: 'hero', x: hero.x + i * 8, y: hero.y }]);
      ctx.frame();
    }
    expect([...tilesOf(ctx).tiles().values()].some((tile) => tile.moving)).toBe(true);

    // The token rests: frames go on as a display's do.
    for (let i = 0; i < 120 && (tilesOf(ctx).busy() || [...tilesOf(ctx).tiles().values()].some((tile) => tile.moving)); i++) {
      await wait(16);
      ctx.frame();
    }
    const left = [...tilesOf(ctx).tiles()].filter(([, tile]) => tile.moving).map(([key]) => key);
    expect(left).toEqual([]);
  }, 120_000);
});
