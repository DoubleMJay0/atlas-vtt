import { describe, expect, it } from 'vitest';
import { doorShape, rotundaRadius, roomShape, shapeDistance, signedArea2, shapePolygon } from '../../../src/app/dungeons/render/geometry';
import { visibleDungeon } from '../../../src/app/dungeons/render/visibleDungeon';
import { insetRuns } from '../../../src/app/dungeons/render/water';
import { taperedOutline } from '../../../src/app/dungeons/render/debris';
import { shadowRegion } from '../../../src/app/dungeons/render/clipShapes';
import { paletteOf } from '../../../src/app/dungeons/render/palette';
import { DEFAULT_VIEW, STYLE_PRESETS } from '../../../src/app/dungeons/style';
import { smallDungeon } from '../../fixtures/dungeonModels';
import { pool } from '../../fixtures/dungeonModelBuilder';
import { rngFrom } from '../../../src/app/dungeons/rng';
import { pointInPolygon } from '../../../src/app/dungeons/render/geometry';

describe('dungeon render geometry', () => {
  it('draws a rotunda through the inner corners of its cardinal door cells', () => {
    const room = smallDungeon().rooms.find(r => r.rotunda)!;
    const circle = roomShape(room);
    expect(circle.kind).toBe('circle');
    expect(rotundaRadius(room)).toBeCloseTo(Math.sqrt(26) / 2);
    // The south door cell's inner edge runs along the floor's bottom row.
    expect(shapeDistance(circle, room.x + room.w / 2 - 0.5, room.y + room.h)).toBeCloseTo(0, 9);
  });

  it('measures signed distance to a rectangle, negative inside', () => {
    const cell = doorShape({ x: 2, y: 3 });
    expect(shapeDistance(cell, 2.5, 3.5)).toBeCloseTo(-0.5);
    expect(shapeDistance(cell, 4, 3.5)).toBeCloseTo(1);
    expect(shapeDistance(cell, 4, 5)).toBeCloseTo(Math.SQRT2);
  });

  it('keeps every polygon clockwise on screen, so a nonzero fill is a union', () => {
    for (const shape of visibleDungeon(smallDungeon(), DEFAULT_VIEW).floors) {
      expect(signedArea2(shapePolygon(shape))).toBeGreaterThan(0);
    }
  });

  it('turns a secret door into wall and hides the secret wing with its doors when asked', () => {
    const model = smallDungeon();
    const shown = visibleDungeon(model, DEFAULT_VIEW);
    const secretDoor = model.doors.find(d => d.kind === 'secret')!;
    expect(shown.doors).toContain(secretDoor);
    expect(shown.field.distance(secretDoor.x + 0.5, secretDoor.y + 0.5)).toBeGreaterThan(0);
    const hidden = visibleDungeon(model, { secrets: false });
    expect(hidden.rooms.some(r => r.wing === 'secret')).toBe(false);
    expect(hidden.doors).not.toContain(secretDoor);
  });

  it('answers the floor field as the union of the floors', () => {
    const dungeon = visibleDungeon(smallDungeon(), DEFAULT_VIEW);
    expect(dungeon.field.distance(0.5, -2.5)).toBeLessThan(0);
    // The door cell between the hall and the rotunda is floor.
    expect(dungeon.field.distance(0.5, -5.5)).toBeLessThan(0);
    expect(dungeon.field.distance(-20, -20)).toBeGreaterThan(1);
  });
});

describe('dungeon render details', () => {
  it('lays ripples a full inset inside their pool', () => {
    const water = pool(rngFrom(3), 0, 0, 2, 1.5);
    const runs = insetRuns(water.outline, 0.3);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) for (const p of run) expect(pointInPolygon(water.outline, p.x, p.y)).toBe(true);
  });

  it('tapers a crack from its width to a point', () => {
    const outline = taperedOutline({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], width: 0.2 });
    expect(outline).toHaveLength(6);
    expect(Math.abs(outline[0]!.y - outline[5]!.y)).toBeCloseTo(0.2);
    expect(outline[2]!.y).toBeCloseTo(outline[3]!.y);
  });

  it('casts the inner shadow on the side the light comes from', () => {
    const room = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    const region = shadowRegion([room], { x: 0.2, y: 0.2 }, []);
    const inside = (x: number, y: number): boolean => region.some(ring => pointInPolygon(ring, x, y));
    expect(inside(0.1, 2)).toBe(true);
    expect(inside(2, 0.1)).toBe(true);
    expect(inside(3.9, 2)).toBe(false);
    expect(inside(2, 2)).toBe(false);
  });

  it('snaps colours to ink or paper in monochrome and takes the shadow away', () => {
    const style = STYLE_PRESETS.parchment;
    const mono = paletteOf(style, { monochrome: true, shadow: true });
    expect([style.colors.ink, style.colors.paper]).toContain(mono.floor);
    expect([style.colors.ink, style.colors.paper]).toContain(mono.water);
    expect(mono.shadow).toBeNull();
    expect(paletteOf(STYLE_PRESETS.stipple, { monochrome: false, shadow: true }).shadow).toBeNull();
    expect(paletteOf(style, { monochrome: false, shadow: true }).shadow).toBe(style.shadow.color);
  });
});
