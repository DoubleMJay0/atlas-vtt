import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../../src/app/dungeons/generate';
import type { CellPoint, DungeonModel, DungeonRoad } from '../../../../src/app/dungeons/model';
import { mapLayout } from '../../../../src/app/dungeons/render/layoutSize';
import { pointInPolygon } from '../../../../src/app/dungeons/render/geometry';
import { roadBand } from '../../../../src/app/dungeons/render/forest/roads';
import { waterField } from '../../../../src/app/dungeons/forest/riverShape';
import type { DungeonTag } from '../../../../src/app/dungeons/tags';
import { MASS_DEPTH } from '../../../../src/app/dungeons/render/forest/woodsMass';
import { visibleDungeon, type VisibleDungeon } from '../../../../src/app/dungeons/render/visibleDungeon';
import { DEFAULT_VIEW } from '../../../../src/app/dungeons/style';

type Vec = CellPoint;

/** Tag sets a GM asks a forest for: sizes, water, life, the layout's shapes. */
const TAG_SETS: readonly DungeonTag[][] = [[], ['small'], ['medium'], ['large'], ['wet'], ['flooded'], ['dry'], ['inhabited'], ['overgrown'], ['large', 'wet'], ['winding'], ['spacious', 'flooded'], ['chaotic'], ['string'], ['deep'], ['crumbling', 'wet']];
/** How many forests: every tag set in turn, one to three floors (caves below widen the map). `VITE_FOREST_ROAD_FORESTS=960` sweeps wider. */
const COUNT = Number(import.meta.env.VITE_FOREST_ROAD_FORESTS ?? 240);
const CASES: { seed: number; tags: DungeonTag[]; floors: number }[] = Array.from({ length: COUNT }, (_, k) => ({
  seed: 5000 + k,
  tags: TAG_SETS[k % TAG_SETS.length]!,
  floors: 1 + (Math.floor(k / TAG_SETS.length) % 3),
}));
/** How near a river's or lake's water an end of a road may never lie unless it runs on (off the map or into another road), in cells. */
const BANK = 3;

interface Forest {
  model: DungeonModel;
  shown: VisibleDungeon;
  roads: DungeonRoad[];
  /** The map's picture, in cells. */
  picture: { minX: number; minY: number; maxX: number; maxY: number };
}

const forests: Forest[] = CASES.map(({ seed, tags, floors }) => {
  const model = generateDungeon({ seed, theme: 'forest', tags, floors });
  const layout = mapLayout(model, 1, DEFAULT_VIEW);
  const { x, y } = layout.originCell;
  return { model, shown: visibleDungeon(model, DEFAULT_VIEW, 0), roads: model.floors[0]!.roads ?? [], picture: { minX: x, minY: y, maxX: x + layout.cellsWide, maxY: y + layout.cellsHigh } };
});

function nearestOnLine(line: readonly Vec[], p: Vec): { distance: number; index: number } {
  let best = { distance: Infinity, index: 0 };
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const distance = Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
    if (distance < best.distance) best = { distance, index: i };
  }
  return best;
}

/** A line's heading at point `i`, over half a cell either side (points lie a quarter cell apart). */
function heading(line: readonly Vec[], i: number, reach = 2): Vec {
  const a = line[Math.max(0, i - reach)]!;
  const b = line[Math.min(line.length - 1, i + reach)]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

/** How far outside the picture `p` lies, in cells (0 inside). */
function outside(picture: Forest['picture'], p: Vec): number {
  return Math.hypot(Math.max(0, picture.minX - p.x, p.x - picture.maxX), Math.max(0, picture.minY - p.y, p.y - picture.maxY));
}

function inRings(rings: readonly (readonly Vec[])[], p: Vec): boolean {
  return rings.filter((ring) => pointInPolygon(ring, p.x, p.y)).length % 2 === 1;
}

type EndKind = 'off the map' | 'merged' | 'at a destination';

/** What a road's end does, or null where it ends in none of the ways a road may end. */
function endOf(forest: Forest, road: DungeonRoad, atStart: boolean): EndKind | null {
  const { roads, picture } = forest;
  const end = atStart ? road.points[0]! : road.points[road.points.length - 1]!;
  // Its worn ground (round at its end) lies wholly beyond the picture.
  if (outside(picture, end) > road.width / 2 + 1) return 'off the map';
  for (const other of roads) {
    if (other === road) continue;
    const on = nearestOnLine(other.points, end);
    if (on.distance > 0.05) continue;
    // It runs into the other road along it, at a slant at most, as a fork joins: never square, never stopping short.
    const own = heading(road.points, atStart ? 0 : road.points.length - 1);
    const theirs = heading(other.points, on.index);
    return Math.abs(own.x * theirs.x + own.y * theirs.y) > Math.cos((35 * Math.PI) / 180) ? 'merged' : null;
  }
  // Anywhere else only where something stands at its very end that it leads to, and never at a river's bank: a road
  // reaching water crosses it or follows it. An entrance of an open clearing is no destination: nothing is drawn there.
  const floor = forest.model.floors[0]!;
  if (waterField(floor.rivers, floor.lakes).distance(end.x, end.y) < BANK) return null;
  const near = (x: number, y: number): boolean => Math.hypot(x - end.x, y - end.y) < 1.5;
  const drawn = floor.props.some((p) => near(p.x, p.y))
    || floor.stairs.some((st) => end.x > st.x - 1 && end.x < st.x + st.w + 1 && end.y > st.y - 1 && end.y < st.y + st.h + 1)
    || floor.terrain.some((piece) => piece.opening !== undefined && piece.cells.some((c) => near(c.x + 0.5, c.y + 0.5)));
  return drawn ? 'at a destination' : null;
}

describe('a Forest’s roads', { timeout: 60000 }, () => {
  it('end off the map, merge into another road along it, or end at something drawn they lead to, never at an entrance or a river’s bank', () => {
    const kinds = new Map<string, number>();
    const wrong: string[] = [];
    forests.forEach((forest, k) => {
      for (const road of forest.roads) {
        for (const atStart of [true, false]) {
          const kind = endOf(forest, road, atStart);
          if (!kind) wrong.push(`${JSON.stringify(CASES[k])} road ${forest.roads.indexOf(road)} ${atStart ? 'start' : 'end'}`);
          kinds.set(kind ?? 'wrong', (kinds.get(kind ?? 'wrong') ?? 0) + 1);
        }
      }
    });
    expect(wrong).toEqual([]);
    // Both kinds of end a road network is made of come up, so the checks above do not pass for want of cases.
    expect(kinds.get('off the map')).toBeGreaterThan(COUNT * 2);
    expect(kinds.get('merged')).toBeGreaterThan(COUNT / 4);
  });

  it('lay their ground whole along their line and either side of it, without a cut or a hole where they bend', () => {
    for (const { roads, picture } of forests) {
      for (const road of roads) {
        const half = road.width / 2;
        const worn = roadBand(road, half);
        const verge = roadBand(road, half + MASS_DEPTH);
        road.points.forEach((p, i) => {
          if (i % 2 || outside(picture, p) > 0) return;
          const h = heading(road.points, i, 1);
          for (const side of [-1, 1]) {
            const at = (reach: number): Vec => ({ x: p.x - h.y * side * reach, y: p.y + h.x * side * reach });
            expect(inRings(worn, at(half * 0.95))).toBe(true);
            expect(inRings(verge, at((half + MASS_DEPTH) * 0.95))).toBe(true);
          }
        });
      }
    }
  });

  it('lead through most entrances, each a way in from the map’s edge', () => {
    let entrances = 0;
    let led = 0;
    for (const { shown, roads } of forests) {
      entrances += shown.ways.length;
      led += shown.ways.filter(({ mouth }) => roads.some((road) => road.points.some((p) => Math.hypot(p.x - mouth.at.x, p.y - mouth.at.y) < 2.5))).length;
    }
    expect(led / entrances).toBeGreaterThan(0.9);
  });
});
