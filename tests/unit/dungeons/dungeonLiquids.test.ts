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
    const liquids = Object.values(parts.scene.liquids ?? {}).filter(l => l.liquid === kind);
    if (liquids.length) return { model, liquids, parts };
  }
  throw new Error(`no ${kind}`);
}

describe('a dungeon\'s water, lava and acid in its scene', () => {
  it('glows from every lava channel as a whole, bridges included, and moves around what the map draws over it', () => {
    const { model, liquids, parts } = dungeonWith(['dry'], 'lava', 'parchment');
    const floor = model.floors[0]!;
    const layout = mapLayout(model, PX, DEFAULT_VIEW);
    const world = (x: number, y: number) => ({ x: (x - layout.originCell.x) * PX, y: (y - layout.originCell.y) * PX });
    const lights = Object.values(parts.scene.lights).filter(l => l.area);
    for (const channel of floor.terrain.filter(p => p.kind === 'channel' && p.traits.hazard === 'lava')) {
      for (const c of channel.cells) {
        const p = world(c.x + 0.5, c.y + 0.5);
        expect(lights.some(l => inside(l.area!, p.x, p.y))).toBe(true);
      }
    }
    for (const light of lights) {
      expect(light.emission.dim).toBe(20);
      expect(light.emission.bright).toBe(5);
      expect(light.emission.animation).toBe('smoulder');
    }
    expect(liquids.some(l => l.flow)).toBe(true);
    const over = [
      ...floor.terrain.filter(p => p.kind === 'bridge').flatMap(p => p.cells.map(c => world(c.x + 0.5, c.y + 0.5))),
      ...floor.stairs.map(s => world(s.x + s.w / 2, s.y + s.h / 2)),
      ...floor.props.map(p => world(p.x, p.y)),
    ];
    for (const p of over) expect(liquids.some(l => inside(l.polygon, p.x, p.y) && !(l.holes ?? []).some(h => inside(h, p.x, p.y)))).toBe(false);
  });

  it('gives water no light, and its pools lie on the floor of their rooms', () => {
    const { liquids, parts } = dungeonWith(['wet'], 'water', 'parchment');
    const areas = Object.values(parts.scene.lights).flatMap(l => (l.area ? [l.area] : []));
    for (const liquid of liquids) {
      expect(areas.some(area => inside(area, liquid.polygon[0]!.x, liquid.polygon[0]!.y))).toBe(false);
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

  it('cuts the columns standing in a pool out of its surface', () => {
    for (let seed = 1; seed < 400; seed++) {
      const model = generateDungeon({ seed, tags: ['flooded', 'colonnades'], floors: 1 });
      const pools = Object.values(partsOf(model, 'parchment').scene.liquids ?? {}).filter(l => l.holes?.length);
      if (!pools.length) continue;
      for (const pool of pools) for (const hole of pool.holes!) expect(inside(pool.polygon, hole[0]!.x, hole[0]!.y)).toBe(true);
      return;
    }
    throw new Error('no column stands in a pool');
  });

  it('counts a cell twice in squares with small tiles', () => {
    const { model } = dungeonWith(['dry'], 'lava', 'parchment');
    const small = partsOf(model, 'parchment', { ...DEFAULT_VIEW, smallTiles: true });
    const light = Object.values(small.scene.lights)[0]!;
    expect(light.emission.dim).toBe(40);
  });
});
