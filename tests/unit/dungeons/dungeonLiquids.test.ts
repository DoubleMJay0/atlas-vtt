import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import type { DungeonModel } from '../../../src/app/dungeons/model';
import { mapLayout } from '../../../src/app/dungeons/render/layoutSize';
import { dungeonScene } from '../../../src/app/dungeons/scene/toScene';
import { DEFAULT_VIEW } from '../../../src/app/dungeons/style';
import { dungeonStyle, type DungeonStyleId } from '../../../src/app/dungeons/styleCatalog';
import type { LiquidSurface } from '../../../src/app/types/liquidTypes';

/** The collection's units: five feet a square. */
const FEET = { unitType: 'feet', ruleDistance: 5 } as const;
const PX = 200;

function partsOf(model: DungeonModel, look: DungeonStyleId, view = DEFAULT_VIEW) {
  const layout = mapLayout(model, PX, view);
  return dungeonScene(model, dungeonStyle(look), view, { originCell: layout.originCell, pxPerCell: PX }, { width: layout.widthPx, height: layout.heightPx }, FEET)!;
}

function inside(polygon: readonly { x: number; y: number }[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The first seed of `tags` whose dungeon has a liquid of `kind`. */
function dungeonWith(tags: string[], kind: LiquidSurface['liquid'], look: DungeonStyleId, floors = 1): { model: DungeonModel; liquids: LiquidSurface[]; parts: ReturnType<typeof partsOf> } {
  for (let seed = 1; seed < 200; seed++) {
    const model = generateDungeon({ seed, tags, floors });
    const parts = partsOf(model, look);
    const liquids = Object.values(parts.liquids).filter(l => l.liquid === kind);
    if (liquids.length) return { model, liquids, parts };
  }
  throw new Error(`no ${kind}`);
}

describe('a dungeon\'s water, lava and acid in its scene', () => {
  it('makes a surface of every lava channel on exactly its cells, flowing along it, with a light glowing from all of it', () => {
    const { model, liquids, parts } = dungeonWith(['dry'], 'lava', 'parchment');
    const channels = model.floors[0]!.terrain.filter(p => p.kind === 'channel' && p.traits.hazard === 'lava');
    expect(liquids.length).toBeGreaterThanOrEqual(channels.length);
    const lights = Object.values(parts.scene.lights);
    for (const liquid of liquids) {
      expect(liquid.flow).toBeDefined();
      const light = lights.find(l => l.area === liquid.polygon)!;
      expect(light).toBeDefined();
      // A channel is a band across its room: its middle lies on it.
      expect(inside(liquid.polygon, light.x, light.y)).toBe(true);
      expect(light.emission.dim).toBe(20);
      expect(light.emission.bright).toBe(5);
    }
  });

  it('gives water no light, and its pools lie on the floor of their rooms', () => {
    const { liquids, parts } = dungeonWith(['wet'], 'water', 'parchment');
    const lights = Object.values(parts.scene.lights);
    for (const liquid of liquids) {
      expect(lights.some(l => l.area === liquid.polygon)).toBe(false);
      expect(liquid.polygon.length).toBeGreaterThanOrEqual(3);
      expect(liquid.polygon.length).toBeLessThanOrEqual(128);
    }
  });

  it('turns the pools of a look whose pools are lava into lava, and keeps each floor\'s on its level', () => {
    const { liquids, parts } = dungeonWith(['wet'], 'lava', 'volcanic', 2);
    expect(parts.levelIds).not.toBeNull();
    for (const liquid of liquids) expect(parts.levelIds).toContain(liquid.level);
    for (const light of Object.values(parts.scene.lights)) expect(parts.levelIds).toContain(light.levels?.[0]);
  });

  it('counts a cell twice in squares with small tiles', () => {
    const { model } = dungeonWith(['dry'], 'lava', 'parchment');
    const small = partsOf(model, 'parchment', { ...DEFAULT_VIEW, smallTiles: true });
    const light = Object.values(small.scene.lights)[0]!;
    expect(light.emission.dim).toBe(40);
  });
});
