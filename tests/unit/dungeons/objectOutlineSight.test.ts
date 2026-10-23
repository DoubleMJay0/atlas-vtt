import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import { DEFAULT_PX_PER_CELL, mapLayout } from '../../../src/app/dungeons/render/layoutSize';
import { dungeonScene } from '../../../src/app/dungeons/scene/toScene';
import { DEFAULT_VIEW } from '../../../src/app/dungeons/style';
import { dungeonStyle } from '../../../src/app/dungeons/styleCatalog';
import { sealTolerance, worldTexel } from '../../../src/app/lighting/lightingConstants';
import { sealWalls } from '../../../src/app/lighting/sealWalls';
import type { Point } from '../../../src/app/types/visionTypes';
import type { WallSegment } from '../../../src/app/types/wallTypes';
import { computeVisibility, pointInPolygon } from '../../../src/app/vision/visibility';
import { wallList } from '../../../src/app/vision/wallList';

/**
 * A column's outline stops sight (cover) but is no hole: a token that sees a column's faces sees
 * its top, the way the players' picture draws it, and what stands right behind the column stays
 * hidden from it. Before, the outline was a closed wall from both sides and every column top was
 * a black octagon in the players' picture.
 */
describe('the outline of a tall object, as sight sees it', () => {
  it('shows the top of every column a token sees the faces of, and hides what lies behind it', () => {
    const model = generateDungeon({ seed: 3, tags: ['colonnades', 'temple', 'large'], floors: 1 });
    const pxPerCell = DEFAULT_PX_PER_CELL;
    const layout = mapLayout(model, pxPerCell, DEFAULT_VIEW);
    const image = { width: layout.widthPx, height: layout.heightPx };
    const parts = dungeonScene(model, dungeonStyle('parchment'), DEFAULT_VIEW, { originCell: layout.originCell, pxPerCell }, image, { unitType: 'feet', ruleDistance: 5 })!;
    const walls = sealWalls(wallList(parts.scene.walls), sealTolerance(worldTexel(image)));
    const outlines = new Map<string, WallSegment[]>();
    for (const wall of Object.values(parts.scene.walls)) {
      if (!wall.id.includes('_shadow_')) continue;
      outlines.set(wall.chainId!, [...(outlines.get(wall.chainId!) ?? []), wall]);
    }
    let checked = 0;
    for (const faces of outlines.values()) {
      const corners = faces.map((face) => face.p1);
      const middle: Point = { x: corners.reduce((sum, p) => sum + p.x, 0) / corners.length, y: corners.reduce((sum, p) => sum + p.y, 0) / corners.length };
      const radius = Math.max(...corners.map((p) => Math.hypot(p.x - middle.x, p.y - middle.y)));
      for (const angle of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
        const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
        const viewer = { x: middle.x + dx * (radius + pxPerCell * 0.6), y: middle.y + dy * (radius + pxPerCell * 0.6) };
        const sight = computeVisibility(viewer, pxPerCell * 20, walls, undefined, 'sight');
        // Only where the token sees the near face, which another wall or object may hide.
        const near = { x: middle.x + dx * radius * 0.95, y: middle.y + dy * radius * 0.95 };
        const nearOutside = { x: middle.x + dx * (radius + 4), y: middle.y + dy * (radius + 4) };
        if (!pointInPolygon(nearOutside, sight)) continue;
        checked++;
        expect(pointInPolygon(near, sight), `the near edge of the top of ${faces[0]!.chainId}`).toBe(true);
        expect(pointInPolygon(middle, sight), `the top of ${faces[0]!.chainId}`).toBe(true);
        const behind = { x: middle.x - dx * (radius + 6), y: middle.y - dy * (radius + 6) };
        expect(pointInPolygon(behind, sight), `right behind ${faces[0]!.chainId}`).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});
