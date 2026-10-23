import { Container, Matrix, RenderTexture, Sprite } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { DEFAULT_VIEW } from '../../src/app/dungeons/style';
import { LightingEngine } from '../../src/app/pixi/lighting/engine/LightingEngine';
import { ShadeLayer } from '../../src/app/pixi/lighting/engine/ShadeLayer';
import { createTestRenderer } from '../../src/app/pixi/lighting/engine/__tests__/gpuTestUtils';
import { SEES_ALL } from '../../src/app/vision/sight';
import { shadedFloor, torchAt } from './heightShadowsHarness';

/** What shadows from heights cost (printed; nothing timed is asserted): building every lamp's tile, and the shade's pass. */
describe('the cost of shadows from heights', () => {
  it('prints the time to build a lit dungeon with and without its relief, and the shade\'s pass', async () => {
    const renderer = await createTestRenderer(64);
    const floor = shadedFloor({ seed: 404, tags: ['round', 'colonnades', 'temple', 'crumbling'], floors: 1 }, 'parchment', 120);
    const dungeon = visibleDungeon(floor.model, DEFAULT_VIEW, 0);
    const torches = dungeon.rooms.filter((room) => room.w >= 3 && room.h >= 3).slice(0, 8).map((room, i) => torchAt(floor, `torch${i}`, { x: room.x + room.w / 2 + 0.3, y: room.y + room.h / 2 + 0.3 }));
    const bounds = { width: floor.layout.widthPx, height: floor.layout.heightPx };
    const build = (relief: boolean): number => {
      const engine = new LightingEngine(renderer);
      engine.setEnabled(true);
      const start = performance.now();
      engine.update({ bounds, albedo: floor.bare, walls: floor.walls, lights: torches, sight: SEES_ALL, sightRadius: 60, ambient: 0.1, relief: relief ? floor.relief.relief : null });
      engine.flush();
      renderer.gl.finish();
      const ms = performance.now() - start;
      engine.destroy();
      return ms;
    };
    const median = (values: number[]): number => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
    build(true);
    const without = median([build(false), build(false), build(false)]);
    const withRelief = median([build(true), build(true), build(true)]);
    console.log(`${torches.length} torches on ${bounds.width} × ${bounds.height} px (${floor.layout.pxPerCell} px a cell): all tiles ${without.toFixed(1)} ms without relief, ${withRelief.toFixed(1)} ms with (${(withRelief / torches.length).toFixed(1)} ms a torch more: ${((withRelief - without) / torches.length).toFixed(1)})`);

    // The shade's pass over a 1440 × 900 picture, lit, on a map at zoom 0.5.
    const engine = new LightingEngine(renderer);
    const shade = new ShadeLayer(true);
    engine.setShade(shade);
    engine.setEnabled(true);
    engine.update({ bounds, albedo: floor.bare, walls: floor.walls, lights: torches, sight: SEES_ALL, sightRadius: 60, ambient: 0.1, relief: floor.relief.relief });
    engine.flush();
    shade.setImage({ texture: floor.shade!, uvToWorld: new Matrix(bounds.width, 0, 0, bounds.height, 0, 0), hatch: null });
    const stage = new Container();
    const world = new Container();
    world.addChild(new Sprite(floor.bare));
    stage.addChild(world);
    world.scale.set(0.5);
    const target = RenderTexture.create({ width: 1440, height: 900 });
    const shoot = (withShade: boolean): number => {
      if (withShade) world.addChild(shade.view);
      else world.removeChild(shade.view);
      renderer.gl.finish();
      const start = performance.now();
      for (let i = 0; i < 40; i++) {
        renderer.render({ container: stage, target, clear: true });
        // Each frame read back, so every render is drawn to the end before the next.
        renderer.gl.readPixels(0, 0, 1, 1, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, new Uint8Array(4));
      }
      return (performance.now() - start) / 40;
    };
    shoot(true);
    const plain = shoot(false);
    const shaded = shoot(true);
    console.log(`1440 × 900 at zoom 0.5: map ${plain.toFixed(2)} ms, map and shade ${shaded.toFixed(2)} ms`);
    world.removeChild(shade.view);
    engine.destroy();
    shade.destroy();
    target.destroy(true);
    stage.destroy({ children: true });
    floor.destroy();
    renderer.destroy();
    expect(withRelief).toBeGreaterThan(0);
  });
});
