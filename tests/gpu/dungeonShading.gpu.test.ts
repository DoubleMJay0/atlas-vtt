import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../src/app/dungeons/generate';
import type { DungeonModel } from '../../src/app/dungeons/model';
import { mapLayout } from '../../src/app/dungeons/render/layoutSize';
import { renderMap } from '../../src/app/dungeons/render/renderMap';
import { RELIEF_PX_PER_CELL, renderRelief } from '../../src/app/dungeons/render/shading/reliefImage';
import { renderShade, SHADE_PX_PER_CELL, shadowsApart } from '../../src/app/dungeons/render/shading/shadeImage';
import { HEIGHT } from '../../src/app/dungeons/render/terrain/footprints';
import { visibleDungeon } from '../../src/app/dungeons/render/visibleDungeon';
import { createRenderEnv } from '../../src/app/dungeons/render/renderEnv';
import { growthPicture } from '../../src/app/dungeons/render/growth/growthForms';
import { DEFAULT_VIEW } from '../../src/app/dungeons/style';
import { dungeonStyle } from '../../src/app/dungeons/styleCatalog';
import type { Point } from '../../src/app/types/visionTypes';

const TEMPLE = { seed: 404, tags: ['round', 'colonnades', 'temple', 'crumbling'], floors: 1 };

/** The relief's height (0..1) at a point of the dungeon, in cells. */
function heightAt(model: DungeonModel, relief: { width: number; data: Uint8ClampedArray }, at: Point): number {
  const { originCell } = mapLayout(model, RELIEF_PX_PER_CELL, DEFAULT_VIEW);
  const x = Math.floor((at.x - originCell.x) * RELIEF_PX_PER_CELL);
  const y = Math.floor((at.y - originCell.y) * RELIEF_PX_PER_CELL);
  return relief.data[(y * relief.width + x) * 4]! / 255;
}

describe('a generated floor\'s shading', () => {
  const model = generateDungeon(TEMPLE);
  const dungeon = visibleDungeon(model, DEFAULT_VIEW, 0);

  it('has a relief: rock and walls a wall high, the floor flat, what stands as tall as it stands, loose stones left flat', () => {
    const relief = renderRelief(model, dungeonStyle('parchment'), DEFAULT_VIEW, 0)!;
    const layout = mapLayout(model, RELIEF_PX_PER_CELL, DEFAULT_VIEW);
    expect([relief.width, relief.height]).toEqual([layout.widthPx, layout.heightPx]);
    // Outside every room: rock.
    expect(heightAt(model, relief, { x: layout.originCell.x + 0.5, y: layout.originCell.y + 0.5 })).toBe(1);
    // A room's open floor.
    const clear = (p: Point): boolean => dungeon.field.distance(p.x, p.y) < -0.6
      && !dungeon.floor.columns.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 0.8)
      && !dungeon.floor.props.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1.2)
      && !dungeon.floor.terrain.some((piece) => piece.cells.some((c) => Math.abs(c.x + 0.5 - p.x) < 1.1 && Math.abs(c.y + 0.5 - p.y) < 1.1))
      && !dungeon.floor.rubble.some((stone) => stone.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.6));
    const open = dungeon.rooms.flatMap((r) => [...Array(r.w * r.h).keys()].map((k) => ({ x: r.x + (k % r.w) + 0.5, y: r.y + Math.floor(k / r.w) + 0.5 }))).find(clear)!;
    expect(open).toBeDefined();
    expect(heightAt(model, relief, open)).toBe(0);
    // A pillar or statue as tall as the drawing says; a column, where the floor has one, a wall high.
    const tall = dungeon.floor.terrain.find((piece) => piece.kind === 'statue' || piece.kind === 'pillar')!;
    const middle = (cells: readonly Point[]): Point => ({ x: cells.reduce((sum, c) => sum + c.x + 0.5, 0) / cells.length, y: cells.reduce((sum, c) => sum + c.y + 0.5, 0) / cells.length });
    expect(heightAt(model, relief, middle(tall.cells))).toBeCloseTo(HEIGHT[tall.kind]!, 1);
    const column = dungeon.floor.columns.find((c) => !c.shattered && dungeon.field.distance(c.x, c.y) < 0);
    if (column) expect(heightAt(model, relief, column)).toBe(1);
    // Rubble lies on the floor: no lamp casts its shadow (Fabian, 2026-10-23).
    const centre = (points: readonly Point[]): Point => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length });
    const stones = dungeon.floor.rubble.filter((s) => s.points.length >= 3).map((s) => centre(s.points))
      .filter((p) => dungeon.field.distance(p.x, p.y) < -0.6 && !dungeon.floor.props.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1.2)
        && !dungeon.floor.columns.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 0.8)
        && !dungeon.floor.terrain.some((piece) => piece.cells.some((c) => Math.abs(c.x + 0.5 - p.x) < 1.1 && Math.abs(c.y + 0.5 - p.y) < 1.1)));
    expect(stones.length).toBeGreaterThan(0);
    for (const p of stones) expect(heightAt(model, relief, p)).toBe(0);
  });

  it('leaves the plants on the floor of an overgrown dungeon out of its relief', () => {
    const overgrown = generateDungeon({ seed: 12, tags: ['overgrown', 'wet'], floors: 1 });
    const style = dungeonStyle('moss');
    const relief = renderRelief(overgrown, style, DEFAULT_VIEW, 0)!;
    const env = createRenderEnv(new OffscreenCanvas(1, 1).getContext('2d')!, visibleDungeon(overgrown, DEFAULT_VIEW, 0), style, DEFAULT_VIEW, RELIEF_PX_PER_CELL);
    const forms = growthPicture(env).ground.filter((form) => form.leaves.length > 0);
    expect(forms.length).toBeGreaterThan(3);
    const heights = forms.map((form) => heightAt(overgrown, relief, { x: (form.bounds.minX + form.bounds.maxX) / 2, y: (form.bounds.minY + form.bounds.maxY) / 2 }));
    // Where a plant grows the floor is flat, unless something that stands (a prop, a raised floor) is there too.
    expect(heights.filter((h) => h === 0).length).toBeGreaterThan(forms.length * 0.8);
  });

  it('leaves its map without the shadows the shade holds, and the shade darkens where they fell', () => {
    const style = dungeonStyle('parchment');
    const px = 30;
    const layout = mapLayout(model, px, DEFAULT_VIEW);
    const draw = (castShadows: boolean): Uint8ClampedArray => {
      const canvas = new OffscreenCanvas(layout.widthPx, layout.heightPx);
      const ctx = canvas.getContext('2d')!;
      renderMap(ctx, model, style, DEFAULT_VIEW, { pxPerCell: px, castShadows });
      return ctx.getImageData(0, 0, layout.widthPx, layout.heightPx).data;
    };
    const baked = draw(true);
    const bare = draw(false);
    let darker = 0;
    let lighter = 0;
    for (let k = 0; k < baked.length; k += 4) {
      const d = bare[k]! + bare[k + 1]! + bare[k + 2]! - (baked[k]! + baked[k + 1]! + baked[k + 2]!);
      if (d > 30) lighter++;
      if (d < -6) darker++;
    }
    // Only shadows go: the map without them is lighter where they fell, and nowhere darker but in a few pixels of rounding.
    expect(lighter).toBeGreaterThan(baked.length / 4 * 0.01);
    expect(darker).toBeLessThan(baked.length / 4 * 0.0001);

    const shade = renderShade(model, style, DEFAULT_VIEW, 0, 400)!;
    expect(shade.hatch).toBeNull();
    const shadeLayout = mapLayout(model, SHADE_PX_PER_CELL, DEFAULT_VIEW);
    expect([shade.image.width, shade.image.height]).toEqual([shadeLayout.widthPx, shadeLayout.heightPx]);
    let shaded = 0;
    for (let k = 0; k < shade.image.data.length; k += 4) if (shade.image.data[k]! < 200 && shade.image.data[k + 3]! > 0) shaded++;
    expect(shaded).toBeGreaterThan(shade.image.data.length / 4 * 0.01);
  });

  it('cuts an engraving\'s shade as its hatching, and keeps a look\'s shadows in its map where they lighten it', () => {
    expect(renderShade(model, dungeonStyle('print'), DEFAULT_VIEW, 0, 400)?.hatch).toMatchObject({ ink: '#111111', angle: -Math.PI / 4 });
    expect(shadowsApart(dungeonStyle('blueprint'), DEFAULT_VIEW)).toBe(false);
    expect(renderShade(model, dungeonStyle('blueprint'), DEFAULT_VIEW, 0, 400)).toBeNull();
    expect(renderShade(model, dungeonStyle('parchment'), { ...DEFAULT_VIEW, shadow: false }, 0, 400)).toBeNull();
    for (const look of ['parchment', 'volcanic', 'night', 'print', 'contrast'] as const) expect(shadowsApart(dungeonStyle(look), DEFAULT_VIEW)).toBe(true);
  });
});
