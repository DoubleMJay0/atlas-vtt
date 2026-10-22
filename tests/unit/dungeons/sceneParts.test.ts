import { describe, expect, it } from 'vitest';
import { mapLayout } from '../../../src/app/dungeons/render/layoutSize';
import { dungeonScene } from '../../../src/app/dungeons/scene/toScene';
import { DEFAULT_VIEW } from '../../../src/app/dungeons/style';
import { dungeonStyle } from '../../../src/app/dungeons/styleCatalog';
import { smallDungeon } from '../../fixtures/dungeonModels';

const STYLE = dungeonStyle('parchment');

function placement(pxPerCell = 100): { originCell: { x: number; y: number }; pxPerCell: number } {
  const { originCell } = mapLayout(smallDungeon(), pxPerCell, DEFAULT_VIEW);
  return { originCell, pxPerCell };
}

describe('a dungeon scene', () => {
  it('has the dungeon\'s cells for its grid, no lights and dynamic lighting in daylight', () => {
    const layout = mapLayout(smallDungeon(), 100, DEFAULT_VIEW);
    const parts = dungeonScene(smallDungeon(), STYLE, DEFAULT_VIEW, placement(), { width: layout.widthPx, height: layout.heightPx })!;
    expect(parts.scene.grid).toEqual({ size: 100, offsetX: 0, offsetY: 0 });
    expect(parts.scene.lights).toEqual({});
    expect(parts.scene.lighting).toEqual({ enabled: true, ambient: 1 });
    expect(parts.doors).toEqual({ door: 2, gate: 1, barricade: 1, secret: 1 });
    // The map's corner is a cell corner, so every wall of a square room lies a whole number of cells plus half a wall from it
    const half = (STYLE.strokes.thick / 30 / 2) * 100;
    const xs = Object.values(parts.scene.walls).filter(w => w.type === 'solid' && w.p1.x === w.p2.x).map(w => w.p1.x);
    const offGrid = (x: number): number => Math.min(...[x + half, x - half].map(v => Math.abs(v - Math.round(v / 100) * 100)));
    expect(xs.length).toBeGreaterThan(10);
    expect(xs.filter(x => offGrid(x) > 0.1)).toEqual([]);
  });
});
