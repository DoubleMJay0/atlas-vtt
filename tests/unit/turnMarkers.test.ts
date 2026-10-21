import { Container, Ticker } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TurnMarkers, type TurnMarkerState } from '../../src/app/pixi/token-renderer/turnMarker/TurnMarkers';
import { MAP_LAYER_Z } from '../../src/app/pixi/mapLayerOrder';
import { TOKEN_UI_Z_INDEX } from '../../src/app/pixi/TokenControlsUI';
import type { GlowTextureSource } from '../../src/app/pixi/token-renderer/turnMarker/TurnMarker';
import { TurnGlowTextures } from '../../src/app/pixi/token-renderer/turnMarker/turnGlowTextures';
import type { TokenGroupContainer } from '../../src/app/pixi/token-renderer/types';
import type { TokenEntity } from '../../src/app/types';
import { createDefaultInitiativeState, type InitiativeEntry, type InitiativeState } from '../../src/app/types/initiativeTypes';

const token = (id: string, changes: Partial<TokenEntity> = {}): TokenEntity => ({ id, kind: 'token', x: 100, y: 100, imagePath: '', ...changes } as TokenEntity);
const entry = (tokenId: string, order: number, changes: Partial<InitiativeEntry> = {}): InitiativeEntry => ({
  id: `e-${tokenId}`, tokenId, name: tokenId, initiative: 10, initiativeModifier: 0, imagePath: '', isActive: false, isNPC: true, order, ...changes,
});

function sprite(x: number, y: number): TokenGroupContainer {
  const group = new Container() as TokenGroupContainer;
  group.tokenSize = 62;
  group.position.set(x, y);
  return group;
}

/** Glow textures held per shape, without a canvas to paint them on. */
function countingGlows(): GlowTextureSource & { held: Map<string, number> } {
  const held = new Map<string, number>();
  return {
    held,
    take: (extent) => {
      const key = `${extent.radius}`;
      held.set(key, (held.get(key) ?? 0) + 1);
      return { key, texture: null };
    },
    release: (key) => {
      const users = (held.get(key) ?? 0) - 1;
      if (users > 0) held.set(key, users);
      else held.delete(key);
    },
    destroy: () => held.clear(),
  };
}

/** A store and the markers over it; `sprites` are the tokens on the map (one beside the map has none). */
function setup(initiative: InitiativeState, tokens: Record<string, TokenEntity>, sprites: Record<string, TokenGroupContainer>, reduced = true, defeated: ReadonlySet<string> = new Set(), glowSource?: GlowTextureSource) {
  let state: TurnMarkerState = { initiative, objects: { tokens }, grid: { size: 70 }, isMapLoading: false };
  const listeners = new Set<(next: TurnMarkerState) => void>();
  const glows = countingGlows();
  const world = new Container();
  const ticker = new Ticker();
  const markers = new TurnMarkers({
    parent: world,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    spriteOf: (id) => sprites[id] ?? null,
    ticker: () => ticker,
    reducedMotion: () => reduced,
    defeated: () => defeated,
    glows: glowSource ?? glows,
  });
  const set = (changes: Partial<TurnMarkerState>): void => {
    state = { ...state, ...changes };
    for (const listener of listeners) listener(state);
  };
  const follow = (): void => ticker.update(performance.now() + 16);
  return { markers, world, set, follow, glows, get: () => state };
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

const order = (active: string): InitiativeState => ({
  ...createDefaultInitiativeState(), isActive: true, round: 1,
  entries: ['hero', 'ogre', 'ghost', 'away'].map((id, index) => entry(id, index, { isActive: id === active })),
});
const tokens = { hero: token('hero', { vision: { enabled: true } } as Partial<TokenEntity>), ogre: token('ogre'), ghost: token('ghost', { isHidden: true }), away: token('away', { offMap: true } as Partial<TokenEntity>) };
const sprites = { hero: sprite(100, 100), ogre: sprite(300, 100), ghost: sprite(500, 100) };

describe('the turn marker', () => {
  it('stands above the lighting and below the tokens\' bars', () => {
    expect(MAP_LAYER_Z.turn).toBeGreaterThan(90);
    expect(MAP_LAYER_Z.turn).toBeLessThan(TOKEN_UI_Z_INDEX);
    const { markers } = setup(order('ogre'), tokens, sprites);
    cleanups.push(() => markers.destroy());
    expect(markers.layer.zIndex).toBe(MAP_LAYER_Z.turn);
  });

  it('marks the token with the turn and moves on with the turn; none outside a fight', () => {
    const { markers, set } = setup(order('ogre'), tokens, sprites);
    cleanups.push(() => markers.destroy());
    expect(markers.tokenIds).toEqual(['ogre']);
    set({ initiative: order('hero') });
    expect(markers.tokenIds).toEqual(['hero']);
    set({ initiative: { ...order('hero'), isActive: false } });
    expect(markers.tokenIds).toEqual([]);
  });

  it('marks every acting combatant of the side with the turn, and of tied sides', () => {
    const sides = { ...order('none'), sides: { first: 'players' as const, active: 'opponents' as const } };
    const { markers, set } = setup(sides, tokens, sprites);
    cleanups.push(() => markers.destroy());
    // The combatant beside the map acts with its side but carries no marker
    expect(markers.tokenIds).toEqual(['ogre', 'ghost']);
    set({ initiative: { ...sides, sides: { ...sides.sides, roll: '1d6', rolls: { 1: { players: 2, opponents: 2 } } } } });
    expect(markers.tokenIds.sort()).toEqual(['ghost', 'hero', 'ogre']);
  });

  it('follows its token while it moves, and shows with it', () => {
    const { markers, follow } = setup({ ...order('none'), sides: { first: 'players', active: 'opponents' } }, tokens, sprites);
    cleanups.push(() => markers.destroy());
    follow();
    const views = new Map(markers.layer.children.map((child, index) => [markers.tokenIds[index], child]));
    sprites.ogre.position.set(320, 140);
    follow();
    expect([views.get('ogre')?.x, views.get('ogre')?.y]).toEqual([320, 140]);
    // The canvas hides a token (session view, out of the players' sight): its marker goes with it
    sprites.ogre.visible = false;
    follow();
    expect(views.get('ogre')?.visible).toBe(false);
    sprites.ogre.visible = true;
    // A hidden token in the GM's view is translucent, and so is its marker
    sprites.ghost.alpha = 0.5;
    follow();
    expect(views.get('ghost')?.alpha).toBe(0.5);
    expect(views.has('away')).toBe(false);
  });

  it('shows players only the markers of tokens they see, while their list is shown', () => {
    const { markers } = setup({ ...order('none'), sides: { first: 'players', active: 'opponents' } }, tokens, sprites);
    cleanups.push(() => markers.destroy());
    const seen = (id: string): boolean => id === 'ogre';
    const markerLayers = (shown: boolean): boolean[] => markers.playerLayers(seen, shown).filter(({ layer }) => layer.label !== 'turnArcs').map(({ visible }) => visible);
    // The layer, then the ogre's and the ghost's markers
    expect(markerLayers(true)).toEqual([true, true, false]);
    expect(markerLayers(false).every((visible) => !visible)).toBe(true);
    // A picture of the scene shows none
    expect(markers.pictureLayers()).toEqual([{ layer: markers.layer, visible: false }]);
  });

  it('leaves the defeated of the side with the turn without a marker', () => {
    const sides = { ...order('none'), sides: { first: 'players' as const, active: 'opponents' as const } };
    const { markers } = setup(sides, tokens, sprites, true, new Set(['e-ogre']));
    cleanups.push(() => markers.destroy());
    expect(markers.tokenIds).toEqual(['ghost']);
  });

  it('hides from the canvas where the players are not shown their list, and works the turn out again on request', () => {
    const defeated = new Set<string>();
    const sides = { ...order('none'), sides: { first: 'players' as const, active: 'opponents' as const } };
    const { markers } = setup(sides, tokens, sprites, true, defeated);
    cleanups.push(() => markers.destroy());
    markers.showOnCanvas(false);
    expect(markers.layer.visible).toBe(false);
    markers.showOnCanvas(true);
    expect(markers.layer.visible).toBe(true);
    // The collection's resources changed: the ogre is defeated now
    defeated.add('e-ogre');
    markers.refresh();
    expect(markers.tokenIds).toEqual(['ghost']);
  });

  it('lands as the turn comes, unless motion is reduced, and then stands still', () => {
    // The landing runs on animation frames: here they wait to be called
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('window', { requestAnimationFrame: (run: FrameRequestCallback) => frames.push(run), cancelAnimationFrame: () => undefined });
    cleanups.push(() => vi.unstubAllGlobals());
    const { markers, set } = setup(order('ogre'), tokens, sprites, false);
    cleanups.push(() => markers.destroy());
    // The first look at a running fight draws it as it stands
    expect(markers.layer.children[0]?.scale.x).toBe(1);
    set({ initiative: order('hero') });
    expect(markers.layer.children[0]?.scale.x).toBeGreaterThan(1);
    // Players see it fade in as the canvas does
    const [, landing] = markers.playerLayers(() => true, true);
    expect(landing?.alpha).toBe(0);
    vi.spyOn(performance, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER);
    cleanups.push(() => vi.restoreAllMocks());
    frames.shift()?.(0);
    expect(markers.layer.children[0]?.scale.x).toBe(1);
    expect(markers.playerLayers(() => true, true)[1]?.alpha).toBe(1);
    expect(frames).toEqual([]);
    const reduced = setup(order('ogre'), tokens, sprites, true);
    cleanups.push(() => reduced.markers.destroy());
    reduced.set({ initiative: order('hero') });
    expect(reduced.markers.layer.children[0]?.scale.x).toBe(1);
  });

  it('leaves its crisp edge to the selection while the GM has the token selected, never in the players\' frame', () => {
    const { markers, set } = setup(order('ogre'), tokens, sprites);
    cleanups.push(() => markers.destroy());
    const arcs = (): Container => markers.layer.children[0]!.getChildByLabel('turnArcs')!;
    expect(arcs().alpha).toBe(1);
    set({ selectedIds: ['ogre'] });
    expect(arcs().alpha).toBe(0);
    // Players see no selection: the arcs stay theirs
    expect(markers.playerLayers(() => true, true)).toContainEqual({ layer: arcs(), visible: true, alpha: 1 });
    set({ selectedIds: [] });
    expect(arcs().alpha).toBe(1);
  });

  it('paints one glow for markers of one shape and lets it go with the last of them', () => {
    const sides = { ...order('none'), sides: { first: 'players' as const, active: 'opponents' as const } };
    const { markers, set, glows } = setup(sides, tokens, sprites);
    // The ogre and the ghost are alike: one glow held twice
    expect([...glows.held.values()]).toEqual([2]);
    set({ initiative: { ...sides, isActive: false } });
    expect(glows.held.size).toBe(0);
    markers.destroy();
  });

  it('paints a glow once as the turn passes on and comes back, whatever the tokens\' sizes', () => {
    const painted: number[] = [];
    const textures = new TurnGlowTextures((size) => { painted.push(size); return null; });
    // The hero is as large as the ogre: the glow passes from one marker to the next unpainted
    const alike = setup(order('ogre'), tokens, sprites, true, new Set(), textures);
    alike.set({ initiative: order('hero') });
    alike.set({ initiative: order('ogre') });
    expect(painted).toHaveLength(1);
    alike.markers.destroy();
    // A huge ogre: its glow waits while the hero has the turn, and is there again when it comes back
    painted.length = 0;
    const huge = { ...sprites, ogre: Object.assign(sprite(300, 100), { tokenSize: 186 }) };
    const sizes = setup(order('ogre'), tokens, huge, true, new Set(), new TurnGlowTextures((size) => { painted.push(size); return null; }));
    sizes.set({ initiative: order('hero') });
    sizes.set({ initiative: order('ogre') });
    sizes.set({ initiative: order('hero') });
    expect(painted).toHaveLength(2);
    sizes.markers.destroy();
  });
});
