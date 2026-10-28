import { cellKey } from '../geometry';
import type { CellPoint, DungeonFloor, DungeonRiver, DungeonRiverBridge } from '../model';
import { wayCentre, wayOutsOf, wayPoint, type WayOut } from '../render/cave/mouth/wayOut';
import { pointSegmentDistance } from '../render/geometry';
import { floorCells } from '../water/wetGrid';
import { bends, normalAt, waterField, type WaterField } from './riverShape';
import type { ForestWater } from './forestRivers';

/**
 * Where a Forest's paths cross its rivers, and the footbridges that carry them over. A forest is no
 * road map: its paths are few, the trails into the woods from the map's entrances and the way the
 * layout leads through the clearings (its lane), and a bridge stands only where one of them meets a
 * river too wide to step over, at most `MOST_BRIDGES` on a map. Every other crossing is a ford.
 */

type Vec = CellPoint;

/** At most this many bridges on a map; the trails' crossings come first, then the lane's. */
const MOST_BRIDGES = 2;
/** A path crosses a river this wide or wider on a bridge, a narrower one by stepping through it. */
const BRIDGED = 0.9;
/** A bridge reaches this far onto the banks on either side. */
const BRIDGE_REACH = 0.6;
/** Two bridges stand at least this far apart, in cells. */
const BRIDGES_APART = 8;
/** A trail meets a river where its middle line passes this near the river's, in cells. */
const ON_TRAIL = 0.5;
/** How many of a river's points either side of a crossing a bridge may move to, for a straighter reach: about a cell and a half. */
const SHIFT = 6;

/** Where a path meets a river: the river and its point, and what ground the bridge's ends must stand on. */
interface Crossing {
  river: number;
  at: number;
  ground?: (p: Vec) => boolean;
}

/** The rivers with the bridges their paths need. */
export function pathBridges({ rivers, lakes }: ForestWater, floor: DungeonFloor, seed: number): DungeonRiver[] {
  const field = waterField(rivers, lakes);
  const crossings = [...trailCrossings(rivers, floor, seed), ...laneCrossings(rivers, floor)];
  const bridges: DungeonRiverBridge[][] = rivers.map(() => []);
  const placed: Vec[] = [];
  for (const crossing of crossings) {
    if (placed.length >= MOST_BRIDGES) break;
    const bridge = bridgeNear(rivers[crossing.river]!, crossing, field);
    if (!bridge || placed.some((p) => Math.hypot(p.x - bridge.at.x, p.y - bridge.at.y) < BRIDGES_APART)) continue;
    bridges[crossing.river]!.push(bridge);
    placed.push(bridge.at);
  }
  return rivers.map((river, k) => ({ ...river, bridges: bridges[k]! }));
}

/** The middle line of a trail, from its mouth to where it has faded into the woods. */
export function trailLine(way: WayOut): Vec[] {
  return Array.from({ length: Math.ceil(way.length / 0.25) + 1 }, (_, k) => {
    const u = Math.min(way.length, k * 0.25);
    return wayPoint(way, u, wayCentre(way, u));
  });
}

/** Each trail's first meeting with a river: the river's point nearest the trail's middle line. */
function trailCrossings(rivers: readonly DungeonRiver[], floor: DungeonFloor, seed: number): Crossing[] {
  // The trails as the drawing lays them (`visibleDungeon`: the entry floor's seed is the dungeon's).
  return wayOutsOf({ ...floor, forest: true }, floor.doors, seed).flatMap((way) => {
    const line = trailLine(way);
    let found: Crossing | null = null;
    let nearest = ON_TRAIL;
    rivers.forEach((river, r) => river.points.forEach((p, i) => {
      for (let k = 0; k + 1 < line.length; k++) {
        const d = pointSegmentDistance(p, line[k]!, line[k + 1]!);
        if (d < nearest) { nearest = d; found = { river: r, at: i }; }
      }
    }));
    return found ? [found] : [];
  });
}

/** Where a river runs through the lane's cells: one crossing in the middle of each run, its ends on the clearing's dry ground. */
function laneCrossings(rivers: readonly DungeonRiver[], floor: DungeonFloor): Crossing[] {
  const lane = new Set((floor.cave?.lane ?? []).map((c) => cellKey(c.x, c.y)));
  if (!lane.size) return [];
  const dry = new Set(floorCells(floor.rooms).map((c) => cellKey(c.x, c.y)));
  for (const c of floor.waterCells) dry.delete(cellKey(c.x, c.y));
  const ground = (p: Vec): boolean => dry.has(cellKey(Math.floor(p.x), Math.floor(p.y)));
  return rivers.flatMap((river, r) => {
    const crossings: Crossing[] = [];
    let start = -1;
    river.points.forEach((p, i) => {
      const on = lane.has(cellKey(Math.floor(p.x), Math.floor(p.y)));
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        crossings.push({ river: r, at: Math.floor((start + i) / 2), ground });
        start = -1;
      }
    });
    return crossings;
  });
}

/** A bridge at the straightest point near the crossing where the river is too wide to step over and both ends of the bridge stand clear of all water, on the ground the crossing asks for. */
function bridgeNear(river: DungeonRiver, crossing: Crossing, field: WaterField): DungeonRiverBridge | null {
  const bent = bends(river.points);
  const near = Array.from({ length: SHIFT * 2 + 1 }, (_, k) => crossing.at - SHIFT + k)
    .filter((i) => i >= 0 && i < river.points.length)
    .sort((a, b) => Math.abs(bent[a]!) - Math.abs(bent[b]!));
  for (const i of near) {
    const width = river.widths[i]!;
    if (width < BRIDGED) continue;
    const at = river.points[i]!;
    const along = normalAt(river.points, i);
    const length = width + 2 * BRIDGE_REACH;
    const ends = [-1, 1].map((side) => ({ x: at.x + along.x * side * (length / 2), y: at.y + along.y * side * (length / 2) }));
    if (ends.every((end) => field.distance(end.x, end.y) > 0.1 && (crossing.ground?.(end) ?? true))) return { at, along, length };
  }
  return null;
}
