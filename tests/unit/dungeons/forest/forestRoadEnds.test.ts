import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../../src/app/dungeons/generate';
import type { CellPoint, DungeonModel, DungeonRoad } from '../../../../src/app/dungeons/model';
import { mapLayout } from '../../../../src/app/dungeons/render/layoutSize';
import { pointInPolygon } from '../../../../src/app/dungeons/render/geometry';
import { roadBand, roadWear } from '../../../../src/app/dungeons/render/forest/roads';
import { MASS_DEPTH } from '../../../../src/app/dungeons/render/forest/woodsMass';
import { visibleDungeon, type VisibleDungeon } from '../../../../src/app/dungeons/render/visibleDungeon';
import { DEFAULT_VIEW } from '../../../../src/app/dungeons/style';

type Vec = CellPoint;

/** Forests of every kind: plain, wet (rivers and bridges), large, and with caves below that widen the map. */
const CASES: { seed: number; tags: string[]; floors: number }[] = [
  ...Array.from({ length: 50 }, (_, k) => ({ seed: k + 1, tags: [], floors: 1 })),
  ...Array.from({ length: 40 }, (_, k) => ({ seed: k + 101, tags: ['wet'], floors: 1 })),
  ...Array.from({ length: 25 }, (_, k) => ({ seed: k + 201, tags: ['large'], floors: 1 })),
  ...Array.from({ length: 15 }, (_, k) => ({ seed: k + 301, tags: ['wet'], floors: 2 })),
];

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

type EndKind = 'off the map' | 'merged' | 'at its entrance';

/** What a road's end does, or null where it ends in none of the ways a road may end. */
function endOf({ shown, roads, picture }: Forest, road: DungeonRoad, atStart: boolean): EndKind | null {
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
  // A footpath to an entrance the road could not reach ends at that entrance, in its clearing.
  const atMouth = shown.ways.some((way) => Math.hypot(way.mouth.at.x - end.x, way.mouth.at.y - end.y) < 1);
  return atMouth && shown.field.distance(end.x, end.y) < -0.25 ? 'at its entrance' : null;
}

describe('a Forest’s roads', { timeout: 60000 }, () => {
  it('end off the map, merge into another road along it, or end in the clearing of the entrance they serve', () => {
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
    // Each kind of end comes up, so none of the checks above passes for want of cases.
    expect(kinds.get('off the map')).toBeGreaterThan(200);
    expect(kinds.get('merged')).toBeGreaterThan(25);
    expect(kinds.get('at its entrance')).toBeGreaterThan(5);
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

  it('wear their ground without a hard cut: it never jumps along a road, and fades out at an end in a clearing', () => {
    let deadEnds = 0;
    for (const forest of forests) {
      const { roads, picture, shown } = forest;
      const wear = roadWear(roads, (p) => shown.field.distance(p.x, p.y));
      for (const road of roads) {
        const inPicture = road.points.filter((p) => outside(picture, p) === 0);
        inPicture.slice(1).forEach((p, i) => expect(Math.abs(wear(p) - wear(inPicture[i]!))).toBeLessThan(0.15));
        for (const atStart of [true, false]) {
          if (endOf(forest, road, atStart) !== 'at its entrance') continue;
          deadEnds += 1;
          const end = atStart ? road.points[0]! : road.points[road.points.length - 1]!;
          expect(wear(end)).toBeLessThan(0.05);
        }
      }
    }
    expect(deadEnds).toBeGreaterThan(5);
  });
});
