import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../../src/app/dungeons/generate';
import type { DungeonModel } from '../../../../src/app/dungeons/model';
import { trailLine } from '../../../../src/app/dungeons/forest/pathCrossings';
import { bends, floorWater, waterField, waterStretches } from '../../../../src/app/dungeons/forest/riverShape';
import { signedArea2 } from '../../../../src/app/dungeons/render/geometry';
import { mapLayout } from '../../../../src/app/dungeons/render/layoutSize';
import { loneTrees } from '../../../../src/app/dungeons/render/forest/loneTrees';
import { visibleDungeon } from '../../../../src/app/dungeons/render/visibleDungeon';
import { dungeonScene } from '../../../../src/app/dungeons/scene/toScene';
import { DEFAULT_VIEW } from '../../../../src/app/dungeons/style';
import { dungeonStyle } from '../../../../src/app/dungeons/styleCatalog';

const SEEDS = Array.from({ length: 40 }, (_, k) => k + 1);
const forest = (seed: number, tags: string[] = []): DungeonModel => generateDungeon({ seed, theme: 'forest', tags, floors: 1 });
const area = (rings: readonly (readonly { x: number; y: number }[])[]): number => rings.reduce((sum, ring) => sum + signedArea2(ring) / 2, 0);

describe('a Forest’s rivers', () => {
  it('run through most woods, every wet one, never a dry one, and come out the same for the same request', () => {
    expect(SEEDS.filter((seed) => forest(seed, ['dry']).floors[0]!.rivers).length).toBe(0);
    expect(SEEDS.filter((seed) => forest(seed, ['wet']).floors[0]!.rivers).length).toBeGreaterThanOrEqual(36);
    expect(SEEDS.filter((seed) => forest(seed).floors[0]!.rivers).length).toBeGreaterThan(20);
    expect(forest(7, ['wet'])).toEqual(forest(7, ['wet']));
  });

  it('meander as rivers do, no bend tighter than the banks allow, and sometimes flow into a lake', () => {
    let lakes = 0;
    let sinuous = 0;
    for (const seed of SEEDS) {
      const floor = forest(seed, ['wet']).floors[0]!;
      lakes += floor.lakes?.length ?? 0;
      for (const river of floor.rivers ?? []) {
        // Banks half a width out fold where a bend's radius is under half the width: hold it well clear.
        bends(river.points).forEach((bend, i) => expect(Math.abs(bend) * river.widths[i]!).toBeLessThan(1.25));
        const along = river.points.reduce((sum, p, i) => sum + (i ? Math.hypot(p.x - river.points[i - 1]!.x, p.y - river.points[i - 1]!.y) : 0), 0);
        const first = river.points[0]!;
        const last = river.points[river.points.length - 1]!;
        if (along / Math.hypot(last.x - first.x, last.y - first.y) > 1.15) sinuous += 1;
      }
    }
    expect(lakes).toBeGreaterThan(8);
    expect(sinuous).toBeGreaterThan(20);
  });

  it('vary in width, fork now and then, and a tributary ends in the river it joins', () => {
    let forks = 0;
    for (const seed of SEEDS) {
      const rivers = forest(seed, ['wet']).floors[0]!.rivers ?? [];
      for (const river of rivers) {
        expect(river.widths).toHaveLength(river.points.length);
        expect(Math.max(...river.widths) / Math.min(...river.widths)).toBeGreaterThan(1.2);
      }
      const [main, ...tributaries] = rivers;
      for (const tributary of tributaries) {
        forks += 1;
        const end = tributary.points[tributary.points.length - 1]!;
        expect(waterField([main!]).distance(end.x, end.y)).toBeLessThan(0);
      }
    }
    expect(forks).toBeGreaterThan(10);
  });

  it('keep off stairs and the ways down, and nothing stands in them', () => {
    for (const seed of SEEDS) {
      const floor = forest(seed, ['wet']).floors[0]!;
      const field = waterField(floor.rivers, floor.lakes);
      for (const s of floor.stairs) expect(field.distance(s.x + s.w / 2, s.y + s.h / 2)).toBeGreaterThan(1);
      for (const piece of floor.terrain.filter((p) => p.opening)) for (const c of piece.cells) expect(field.distance(c.x + 0.5, c.y + 0.5)).toBeGreaterThan(1);
      for (const prop of floor.props) expect(field.distance(prop.x, prop.y)).toBeGreaterThan(0.8);
      for (const tree of loneTrees(visibleDungeon(forest(seed, ['wet']), DEFAULT_VIEW, 0))) expect(field.distance(tree.x, tree.y)).toBeGreaterThan(tree.radius);
    }
  });

  it('are bridged only where a path crosses them, two bridges at most on a map, each on dry ground off the water', () => {
    let bridges = 0;
    for (const seed of SEEDS) {
      const model = forest(seed, ['wet']);
      const floor = model.floors[0]!;
      const field = waterField(floor.rivers, floor.lakes);
      const shown = visibleDungeon(model, DEFAULT_VIEW, 0);
      const lane = floor.cave?.lane ?? [];
      const all = (floor.rivers ?? []).flatMap((river) => river.bridges);
      expect(all.length).toBeLessThanOrEqual(2);
      bridges += all.length;
      for (const { at, along, length } of all) {
        // On a trail, or on the lane the layout leads through the clearings (a bridge may move a cell and a half along the river for a straighter reach).
        const onPath = shown.ways.some((way) => trailLine(way).some((p) => Math.hypot(p.x - at.x, p.y - at.y) < 2.5))
          || lane.some((c) => Math.hypot(c.x + 0.5 - at.x, c.y + 0.5 - at.y) < 2);
        expect(onPath).toBe(true);
        for (const side of [-1, 1]) expect(field.distance(at.x + (along.x * side * length) / 2, at.y + (along.y * side * length) / 2)).toBeGreaterThan(0);
      }
      all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y)).toBeGreaterThanOrEqual(8)));
    }
    expect(bridges).toBeGreaterThan(5);
  });

  it('flow in stretches that hold all their water once', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const rivers = forest(seed, ['wet']).floors[0]!.rivers ?? [];
      if (!rivers.length) continue;
      const floor = forest(seed, ['wet']).floors[0]!;
      const stretches = waterStretches(rivers, floor.lakes);
      const whole = area(floorWater(rivers, floor.lakes));
      expect(Math.abs(area(stretches.flatMap((s) => s.rings)) - whole) / whole).toBeLessThan(0.01);
      for (const { flow } of stretches) if (flow) expect(Math.hypot(flow.x, flow.y)).toBeCloseTo(1);
    }
  });

  it('move as water, are waded as difficult ground and crossed dry on their footbridges in the scene', () => {
    let rivers = 0;
    for (const seed of SEEDS.slice(0, 12)) {
      const model = forest(seed, ['wet']);
      if (!model.floors[0]!.rivers) continue;
      rivers += 1;
      const layout = mapLayout(model, 70, DEFAULT_VIEW);
      const parts = dungeonScene(model, dungeonStyle('crayon'), DEFAULT_VIEW, { originCell: layout.originCell, pxPerCell: 70 }, { width: layout.widthPx, height: layout.heightPx }, { unitType: 'feet', ruleDistance: 5 })!;
      const flowing = Object.values(parts.scene.liquids ?? {}).filter((liquid) => liquid.flow);
      expect(flowing.length).toBeGreaterThan(3);
      for (const liquid of flowing) for (const p of liquid.polygon) {
        expect(p.x).toBeGreaterThanOrEqual(-0.01);
        expect(p.y).toBeGreaterThanOrEqual(-0.01);
        expect(p.x).toBeLessThanOrEqual(layout.widthPx + 0.01);
        expect(p.y).toBeLessThanOrEqual(layout.heightPx + 0.01);
      }
      const features = Object.values(parts.scene.mapFeatures ?? {});
      for (const water of features.filter((f) => f.name === 'River' || f.name === 'Lake')) expect(water.terrain?.difficult).toBe(true);
      const decks = model.floors[0]!.rivers!.flatMap((river) => river.bridges).length;
      expect(features.filter((f) => f.name === 'Footbridge')).toHaveLength(decks);
    }
    expect(rivers).toBeGreaterThan(8);
  });
});
