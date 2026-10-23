import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../src/app/dungeons/generate';
import type { DungeonModel } from '../../src/app/dungeons/model';
import { mapLayout } from '../../src/app/dungeons/render/layoutSize';
import { paletteOf, parseHex } from '../../src/app/dungeons/render/palette';
import { renderMap } from '../../src/app/dungeons/render/renderMap';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { dungeonScene } from '../../src/app/dungeons/scene/toScene';
import { dungeonWalls, wallInkWidth } from '../../src/app/dungeons/scene/toWalls';
import { DEFAULT_VIEW, type DungeonView } from '../../src/app/dungeons/style';
import { dungeonStyle, type DungeonStyleId } from '../../src/app/dungeons/styleCatalog';
import { alphaAt, changedMask, gridAgreement, inkEdgesFromWalls, inkMask, outlinesOffObjects, wallsInTerrain, wallsOnInk, type Picture } from './dungeonFidelityChecks';
import type { WallSegment } from '../../src/app/types/wallTypes';

/**
 * A dungeon's scene against the map images it was written for, at the 200 px per cell scenes are
 * drawn at, floor by floor (each its level's walls on its own map): every wall lies on drawn wall
 * ink, every drawn wall face has a wall, doors stand on the drawn doors, the scene's grid is the
 * grid drawn on the map (half cells with small tiles), and every outline of a tall object lies on
 * the object as drawn. The outlines are no drawn walls: the wall checks leave them out.
 */

const PX_PER_CELL = 200;

const CASES: readonly { seed: number; tags: string[]; floors: number; look: DungeonStyleId; view: Partial<DungeonView>; fiveRoom?: boolean }[] = [
  { seed: 101, tags: ['medium'], floors: 1, look: 'parchment', view: {} },
  { seed: 202, tags: ['small', 'round'], floors: 2, look: 'night', view: { smallTiles: true } },
  { seed: 303, tags: ['small', 'secret', 'temple'], floors: 2, look: 'masonry', view: { monochrome: true } },
  { seed: 404, tags: ['small', 'winding'], floors: 3, look: 'stipple', view: { smallTiles: true, grid: 'solid' } },
  { seed: 505, tags: ['medium', 'colonnades'], floors: 1, look: 'blueprint', view: { exits: false } },
  // Terrain: a gallery over the arena and a bridged chasm onto the floor below, and a five-room dungeon.
  { seed: 282, tags: ['small'], floors: 2, look: 'parchment', view: {} },
  { seed: 375, tags: ['small', 'crumbling', 'dry'], floors: 2, look: 'sepia', view: { smallTiles: true } },
  { seed: 42, tags: [], floors: 1, look: 'masonry', view: {}, fiveRoom: true },
];

const TALL_TERRAIN = new Set(['pillar', 'obelisk', 'statue', 'wall-fragment']);

/** The dungeon without its tall objects: the columns that stand, statues and wells, and terrain that is total cover. */
function withoutTallObjects(model: DungeonModel): DungeonModel {
  return {
    ...model,
    floors: model.floors.map(floor => ({
      ...floor,
      columns: floor.columns.filter(column => column.shattered),
      props: floor.props.filter(prop => prop.kind !== 'statue' && prop.kind !== 'well'),
      terrain: floor.terrain.filter(piece => !TALL_TERRAIN.has(piece.kind)),
    })),
  };
}

/** A floor's outlines of tall objects, each a ring of corners. */
function outlinesOf(walls: readonly WallSegment[]): { x: number; y: number }[][] {
  const rings = new Map<string, { x: number; y: number }[]>();
  for (const wall of walls) rings.set(wall.chainId!, [...(rings.get(wall.chainId!) ?? []), wall.p1]);
  return [...rings.values()];
}

function draw(model: DungeonModel, look: DungeonStyleId, view: DungeonView, floor: number): Picture {
  const layout = mapLayout(model, PX_PER_CELL, view);
  const canvas = new OffscreenCanvas(layout.widthPx, layout.heightPx);
  const ctx = canvas.getContext('2d')!;
  renderMap(ctx, model, dungeonStyle(look), view, { pxPerCell: PX_PER_CELL, floor });
  return { data: ctx.getImageData(0, 0, layout.widthPx, layout.heightPx).data, width: layout.widthPx, height: layout.heightPx };
}

const share = (values: readonly number[], limit: number): number => values.filter(v => v <= limit).length / Math.max(1, values.length);

let outlined = 0;

describe('a dungeon scene and its map image', () => {
  for (const { seed, tags, floors, look, view: change, fiveRoom } of CASES) {
    const view: DungeonView = { ...DEFAULT_VIEW, ...change };
    const label = `seed ${seed} [${tags.join(',')}], ${floors} floors, ${look}${view.monochrome ? ' monochrome' : ''}${view.smallTiles ? ', small tiles' : ''}`;
    it(`agree on walls, doors and grid: ${label}`, () => {
      const model = generateDungeon({ seed, tags, floors, ...(fiveRoom && { fiveRoom }) });
      const style = dungeonStyle(look);
      const palette = paletteOf(style, view);
      const layout = mapLayout(model, PX_PER_CELL, view);
      const placement = { originCell: layout.originCell, pxPerCell: PX_PER_CELL };
      const scene = dungeonScene(model, style, view, placement, { width: layout.widthPx, height: layout.heightPx })!;
      expect(scene.scene.grid.size).toBe(view.smallTiles ? PX_PER_CELL / 2 : PX_PER_CELL);
      const halfInk = (wallInkWidth(style) / 2) * PX_PER_CELL;
      const level = (index: number): string | undefined => scene.levelIds?.[index];
      model.floors.forEach((floor, index) => {
        const where = `${label}, floor ${index}`;
        const picture = draw(model, look, view, index);
        const mask = inkMask(picture, parseHex(palette.ink));
        const onFloor = Object.values(scene.scene.walls).filter(wall => wall.levels?.[0] === level(index));
        const outlines = onFloor.filter(wall => wall.id.includes('_shadow_'));
        const walls = onFloor.filter(wall => !wall.id.includes('_shadow_'));
        // The floor's own walls are the scene's on its level, as the scene writer builds them alone
        expect(walls.length, where).toBe(Object.keys(dungeonWalls(model, style, view, placement, index, { id: 'x' }).walls).length);
        const toPx = (x: number, y: number): { x: number; y: number } => ({ x: (x - layout.originCell.x) * PX_PER_CELL, y: (y - layout.originCell.y) * PX_PER_CELL });

        // (a) Solid walls lie on drawn ink; the sides of a secret door's passage are not drawn, as the passage is not
        const inSecretCell = (p: { x: number; y: number }): boolean => floor.doors.some(d => d.kind === 'secret' && Math.abs(p.x - toPx(d.x + 0.5, d.y + 0.5).x) <= PX_PER_CELL / 2 + halfInk + 1 && Math.abs(p.y - toPx(d.x + 0.5, d.y + 0.5).y) <= PX_PER_CELL / 2 + halfInk + 1);
        const onInk = wallsOnInk(walls.filter(w => w.type !== 'door'), mask, picture).filter(s => !inSecretCell(s.at));
        const far = onInk.filter(s => s.distance > 6).slice(0, 5).map(s => `${Math.round(s.at.x)},${Math.round(s.at.y)}`);
        expect(far, `${where}: walls beyond 6 px of ink`).toEqual([]);
        expect(share(onInk.map(s => s.distance), 2), `${where}: walls within 2 px of ink`).toBeGreaterThanOrEqual(0.99);

        // Doors stand across the middle of the drawn door, at right angles to the way through
        for (const door of floor.doors.filter(d => d.kind === 'door')) {
          const centre = toPx(door.x + 0.5, door.y + 0.5);
          const wall = walls.filter(w => w.type === 'door').find(w => Math.hypot((w.p1.x + w.p2.x) / 2 - centre.x, (w.p1.y + w.p2.y) / 2 - centre.y) <= 2);
          expect(wall, `${where}: door at ${door.x},${door.y}`).toBeDefined();
          const along = { x: wall!.p2.x - wall!.p1.x, y: wall!.p2.y - wall!.p1.y };
          expect(Math.abs(along.x * door.dir.x + along.y * door.dir.y)).toBeLessThan(0.5);
        }

        // (b) Every drawn wall face has a wall along the ink's middle
        const field = visibleDungeon(model, view, index).field;
        const edges = inkEdgesFromWalls(floor, field, walls, mask, picture, placement);
        const loose = edges.filter(e => e.distance > halfInk + 3).slice(0, 5).map(e => `${e.at.x},${e.at.y} (${e.distance.toFixed(1)} px)`);
        expect(edges.length, `${where}: wall faces found`).toBeGreaterThan(1000);
        expect(loose, `${where}: drawn wall faces without a wall`).toEqual([]);

        // No wall stands in a hole or on a bridge: sight passes over a chasm. A hole over a floor below is cut out of the image; a bridge is not
        expect(wallsInTerrain(floor, walls, placement), `${where}: walls in holes or on bridges`).toEqual([]);
        const deepest = index === model.floors.length - 1;
        const bridged = new Set(floor.terrain.filter(p => p.kind === 'bridge').flatMap(p => p.cells.map(c => `${c.x},${c.y}`)));
        for (const hole of floor.terrain.filter(p => p.opening)) {
          for (const c of hole.cells) {
            const alpha = alphaAt(picture, placement, c);
            if (bridged.has(`${c.x},${c.y}`)) expect(alpha, `${where}: bridge at ${c.x},${c.y}`).toBe(255);
            else expect(alpha, `${where}: ${hole.kind} at ${c.x},${c.y}`).toBe(deepest ? 255 : 0);
          }
        }

        // The scene's grid lines are the drawn ones, and no drawn line lies between them
        const { on, off } = gridAgreement(floor, scene.scene.grid, picture, placement, { grid: parseHex(palette.grid), floor: parseHex(palette.floor) });
        expect(on, `${where}: grid pixels on the scene's lines`).toBeGreaterThan(200);
        expect(off, `${where}: grid pixels between the scene's lines`).toBeLessThan(on * 0.1);

        // (c) Every outline of a tall object lies on the object as drawn (both drawn without shadows, which fall beside it)
        const plain = { ...view, shadow: false };
        const changed = changedMask(draw(model, look, plain, index), draw(withoutTallObjects(model), look, plain, index));
        const stray = outlinesOffObjects(outlinesOf(outlines), changed, picture, PX_PER_CELL * 0.12, 0.15).slice(0, 5).map(p => `${Math.round(p.x)},${Math.round(p.y)}`);
        expect(stray, `${where}: outlines off their drawn object`).toEqual([]);
        outlined += outlinesOf(outlines).length;
      });
    });
  }
  it('outlines tall objects in the cases above', () => {
    expect(outlined).toBeGreaterThan(20);
  });
});
