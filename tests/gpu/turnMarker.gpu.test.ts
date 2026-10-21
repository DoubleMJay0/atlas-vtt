import { Application, Container, Graphics } from 'pixi.js';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { TurnMarkers, type TurnMarkerState } from '../../src/app/pixi/token-renderer/turnMarker/TurnMarkers';
import { TURN_LOOK, arcLayout } from '../../src/app/pixi/token-renderer/turnMarker/turnMarkerShape';
import { LIGHTING_Z_INDEX } from '../../src/app/pixi/lighting/LightingRenderer';
import { TOKEN_UI_Z_INDEX } from '../../src/app/pixi/TokenControlsUI';
import { getTokenRingOuterDiameter } from '../../src/app/pixi/token-renderer/tokenRingMetrics';
import { computeTokenPixelSize, computeTokenStrokeWidth } from '../../src/app/pixi/token-renderer/tokenSizing';
import { forgetObsidianAccentColor } from '../../src/app/pixi/utils/colorUtils';
import { copiedPixel } from '../../src/app/pixi/lighting/engine/__tests__/gpuTestUtils';
import type { TokenGroupContainer } from '../../src/app/pixi/token-renderer/types';
import type { TokenEntity } from '../../src/app/types';
import { createDefaultInitiativeState } from '../../src/app/types/initiativeTypes';

const SIZE = 320;
const GRID = 70;
const SHOTS = '__screenshots__/init-turn';
const ACCENT = [0x7f, 0x6d, 0xf2];

/**
 * The marker in the stacking the map gives it: a lit map (the composite at `LIGHTING_Z_INDEX`, here
 * a dark veil over everything beneath it, as a dark scene lights the floor and the tokens), the
 * marker, and a token's bar standing over it at `TOKEN_UI_Z_INDEX`.
 */
describe('the turn marker on a lit map', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  async function scene(zoom: number): Promise<{ app: Application; markers: TurnMarkers; world: Container; centre: { x: number; y: number }; outer: number }> {
    document.body.style.setProperty('--interactive-accent', '#7f6df2');
    forgetObsidianAccentColor();
    const app = new Application();
    await app.init({ width: SIZE, height: SIZE, preference: 'webgl', antialias: true, autoStart: false, backgroundColor: 0x000000 });
    cleanup.push(() => app.destroy(true, { children: true }));
    document.body.append(app.canvas);
    cleanup.push(() => app.canvas.remove());
    const world = new Container({ sortableChildren: true });
    world.scale.set(zoom);
    world.position.set(SIZE / 2 - 160 * zoom, SIZE / 2 - 160 * zoom);
    app.stage.addChild(world);
    world.addChild(new Graphics({ zIndex: 0 }).rect(0, 0, 320, 320).fill(0xb8a888));
    const size = computeTokenPixelSize(GRID, 1);
    const sprite = new Container({ zIndex: 0 }) as TokenGroupContainer;
    sprite.tokenSize = size;
    sprite.position.set(160, 160);
    sprite.addChild(new Graphics().circle(0, 0, size / 2).fill(0xc0392b));
    world.addChild(sprite);
    world.addChild(new Graphics({ zIndex: LIGHTING_Z_INDEX }).rect(0, 0, 320, 320).fill({ color: 0x000000, alpha: 0.85 }));
    // A resource bar across the token's bottom edge, where the marker runs under it
    const outer = getTokenRingOuterDiameter(size, computeTokenStrokeWidth(GRID)) / 2;
    world.addChild(new Graphics({ zIndex: TOKEN_UI_Z_INDEX }).rect(130, 160 + outer, 60, 8).fill(0xffffff));
    const state: TurnMarkerState = {
      initiative: { ...createDefaultInitiativeState(), isActive: true, round: 1, entries: [{ id: 'e', tokenId: 'ogre', name: 'Ogre', initiative: 12, initiativeModifier: 0, imagePath: '', isActive: true, isNPC: true, order: 0 }] },
      objects: { tokens: { ogre: { id: 'ogre', kind: 'character', x: 160, y: 160, imagePath: '' } as TokenEntity } },
      grid: { size: GRID },
    };
    const markers = new TurnMarkers({ parent: world, getState: () => state, subscribe: () => () => undefined, spriteOf: () => sprite, ticker: () => app.ticker, reducedMotion: () => true });
    cleanup.push(() => markers.destroy());
    app.ticker.update();
    app.render();
    return { app, markers, world, centre: { x: SIZE / 2, y: SIZE / 2 }, outer };
  }

  const near = (pixel: number[], colour: number[], tolerance = 24): boolean => pixel.every((value, index) => Math.abs(value - colour[index]!) <= tolerance);

  it('stands above the lighting in the accent, under the token\'s bar, and players see it only where they see the token', async () => {
    const { app, markers, centre, outer } = await scene(1);
    const arc = arcLayout(outer, 1, 1);
    // Half a pixel out from the arc's middle line lies a pixel the arc covers whole
    const onArc = (angle: number, radius = arc.radius + 0.5): [number, number] => [Math.round(centre.x + Math.cos(angle) * radius), Math.round(centre.y + Math.sin(angle) * radius)];
    // Up and left of the token, on an arc: the accent, undimmed by the veil
    expect(near(copiedPixel(app.canvas, ...onArc(-0.75 * Math.PI)), ACCENT)).toBe(true);
    // Left of it, between two arcs, the glow lights the veiled floor in the accent's hue
    const glow = copiedPixel(app.canvas, ...onArc(Math.PI, outer + 3));
    expect(glow[2]!).toBeGreaterThan(90);
    expect(glow[2]!).toBeGreaterThan(glow[1]! + 30);
    // The token itself lies under the lighting, and the glow leaves it alone: dark
    expect(copiedPixel(app.canvas, centre.x, centre.y).every((value) => value < 60)).toBe(true);
    // Below the token the bar stands over the glow
    expect(copiedPixel(app.canvas, centre.x, Math.round(centre.y + outer + 4))).toEqual([255, 255, 255]);
    await page.screenshot({ path: `${SHOTS}/marker-gm.png`, element: app.canvas });

    for (const { layer, visible } of markers.playerLayers(() => false, true)) layer.visible = visible;
    app.render();
    expect(near(copiedPixel(app.canvas, ...onArc(-0.75 * Math.PI)), ACCENT)).toBe(false);
  });

  it('keeps its arcs smooth curves when the map is zoomed in', async () => {
    const { app, centre, outer } = await scene(4);
    const arc = arcLayout(outer, 1, 4);
    // Along the middle line of the upper arcs, away from their tapered ends, is the accent: no corner cuts them
    for (const middle of [-0.75 * Math.PI, -0.25 * Math.PI]) {
      for (let step = -4; step <= 4; step += 1) {
        const angle = middle + (step / 4) * (TURN_LOOK.arcSpan / 2) * 0.6;
        const x = Math.round(centre.x + Math.cos(angle) * arc.radius);
        const y = Math.round(centre.y + Math.sin(angle) * arc.radius);
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        expect(near(copiedPixel(app.canvas, x, y), ACCENT), `at ${x},${y}`).toBe(true);
      }
    }
    await page.screenshot({ path: `${SHOTS}/marker-zoomed.png`, element: app.canvas });
  });
});
