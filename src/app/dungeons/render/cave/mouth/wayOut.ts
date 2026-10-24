/**
 * The way out of a cave: before each entrance the cave's floor runs on as trodden ground for a few
 * cells, a little wider and bending a little, and fades into the paper. Pure geometry in cells,
 * shared by the painters, the rock that parts round it, the relief and the grid.
 */

import type { DungeonDoor, DungeonFloor, DungeonModel } from '../../../model';
import { mouthLane, mouthsOf, type Mouth } from '../../art/mouths';
import { hash2, valueNoise } from '../../art/noise';
import { smoothstep } from '../../art/paths';
import type { Bounds, Vec } from '../../geometry';

export interface WayOut {
  mouth: Mouth;
  /** How far beyond the mouth the ground reaches before it is gone, in cells. */
  length: number;
  /** How much wider than the mouth its far end is, on either side, in cells. */
  spread: number;
  /** How far its far end lies to one side of straight on, in cells. */
  bend: number;
  seed: number;
}

/** The ground's strength above which it reads as floor: the grid is drawn there. */
export const FLOOR_STRENGTH = 0.5;

/** A floor as shown, as far as its ways out need it. */
interface ShownFloor {
  model: DungeonModel;
  index: number;
  floor: DungeonFloor;
  doors: readonly DungeonDoor[];
}

/** A floor as shown with the distance to its floors. */
type ShownWays = ShownFloor & { field: { distance(x: number, y: number): number } };

const memo = new WeakMap<readonly DungeonDoor[], WayOut[]>();

/** The ways out of the entrances of a floor as shown: none but on a cave floor. */
export function caveWayOuts(shown: ShownFloor): WayOut[] {
  if (!shown.floor.cave) return [];
  let ways = memo.get(shown.doors);
  if (!ways) {
    ways = wayOutsOf(shown.doors, shown.model.seed + shown.index * 101);
    memo.set(shown.doors, ways);
  }
  return ways;
}

function wayOutsOf(doors: readonly DungeonDoor[], seed: number): WayOut[] {
  return mouthsOf({ doors }).map((mouth) => {
    const key = seed + Math.round(mouth.at.x * 7) * 131 + Math.round(mouth.at.y * 7) * 7919;
    return { mouth, length: 2.6 + hash2(1, 0, key) * 1.1, spread: 0.3 + hash2(2, 0, key) * 0.3, bend: (hash2(3, 0, key) - 0.5) * 0.7, seed: key };
  });
}

/** A point of the way's frame: `u` cells out from the mouth's middle, `v` across. */
export function wayPoint({ mouth: { at, out } }: WayOut, u: number, v: number): Vec {
  return { x: at.x + out.x * u - out.y * v, y: at.y + out.y * u + out.x * v };
}

/** A point in the way's frame: how far out (`u`) and across (`v`). */
export function wayFrameOf({ mouth: { at, out } }: WayOut, p: Vec): { u: number; v: number } {
  const dx = p.x - at.x;
  const dy = p.y - at.y;
  return { u: dx * out.x + dy * out.y, v: -dx * out.y + dy * out.x };
}

/** The middle of the way at `u` out. */
export function wayCentre(way: WayOut, u: number): number {
  const t = Math.max(0, u) / way.length;
  return way.bend * t * t;
}

/** Half the way's width at `u` out on `side` (−1, 1): the mouth's at the mouth, wandering wider outwards. */
export function wayHalf(way: WayOut, u: number, side: number): number {
  const t = Math.min(1, Math.max(0, u) / way.length);
  const wander = (valueNoise(u * 1.7 + side * 13.1, side * 3.3, way.seed) - 0.5) * 0.36;
  return way.mouth.width / 2 + (way.spread + wander) * t;
}

/**
 * How strongly the ground shows at `p`, 0..1: whole at the mouth, fading out along the way to
 * nothing at its length with a ragged front, and softening at the sides the farther out it lies.
 * `distance`, where given, is the distance to the floors: the ground gives way where another
 * floor lies nearer than the mouth, so it never runs over the rock round another room.
 */
export function wayStrength(way: WayOut, p: Vec, distance?: (p: Vec) => number): number {
  const { u, v } = wayFrameOf(way, p);
  if (u < -0.1) return 0;
  const across = v - wayCentre(way, u);
  const side = across < 0 ? -1 : 1;
  const soft = 0.05 + 0.32 * Math.min(1, Math.max(0, u) / way.length);
  const sides = smoothstep(0, soft, wayHalf(way, u, side) - Math.abs(across));
  if (sides <= 0) return 0;
  const ragged = (valueNoise(across * 2.6 + 5.1, u * 0.8, way.seed + 1) - 0.5) * 0.9 * Math.min(1, Math.max(0, u) / way.length);
  const along = 1 - smoothstep(way.length * 0.18, way.length, Math.max(0, u) + ragged);
  if (along <= 0) return 0;
  const clear = distance ? smoothstep(-0.55, -0.15, distance(p) - Math.max(0, u)) : 1;
  return sides * along * clear;
}

/** Rays from the mouth's middle, out over a half turn, that the ground's contours are found along. */
const RAYS = 48;
/** Steps a ray is walked in before its last crossing is refined, in cells. */
const RAY_STEP = 0.04;

/**
 * The ring round the ground at least `level` strong, closed a little inside the mouth so it
 * overlaps the floor: the ground is star-shaped seen from the mouth's middle, so each ray's last
 * crossing of the level is the ring.
 */
export function wayRing(way: WayOut, level: number, distance?: (p: Vec) => number): Vec[] {
  const { out } = way.mouth;
  const reach = way.length + way.spread + Math.abs(way.bend) + way.mouth.width;
  const ring: Vec[] = [wayPoint(way, -0.06, -way.mouth.width / 2)];
  for (let k = 0; k <= RAYS; k++) {
    const angle = -Math.PI / 2 + (k / RAYS) * Math.PI;
    const dir = { x: out.x * Math.cos(angle) + out.y * Math.sin(angle), y: out.y * Math.cos(angle) - out.x * Math.sin(angle) };
    const at = (r: number): Vec => ({ x: way.mouth.at.x + dir.x * r, y: way.mouth.at.y + dir.y * r });
    let last = 0;
    for (let r = RAY_STEP; r <= reach; r += RAY_STEP) if (wayStrength(way, at(r), distance) >= level) last = r;
    let lo = last;
    let hi = last + RAY_STEP;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      if (wayStrength(way, at(mid), distance) >= level) lo = mid;
      else hi = mid;
    }
    ring.push(at(lo));
  }
  ring.push(wayPoint(way, -0.06, way.mouth.width / 2));
  return ring;
}

/** The corners of what the way may cover, for sizing the map round it; the ground is gone well before its length. */
export function wayExtent(way: WayOut, reach: number): Bounds {
  const points = [-1, 1].flatMap((side) => [0, reach].map((u) => wayPoint(way, u, wayCentre(way, u) + side * wayHalf(way, u, side))));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** How far the rock keeps back from the faintest trodden ground, in cells: room for the scree that ends the walls. */
const ROCK_CLEAR = 0.04;

/**
 * The open ground before every way in, where no rock stands and no wall's shadow falls: before a
 * cave's mouth its way out, before a built entrance its lane (`mouthLane`).
 */
export function openGround(shown: ShownWays): Vec[][] {
  if (!shown.floor.cave) return mouthsOf(shown).map(mouthLane);
  return caveWayOuts(shown).map((way) => groundRing(shown, way, ROCK_CLEAR));
}

const rings = new WeakMap<WayOut, Map<number, Vec[]>>();

/** `wayRing` of a way of `shown`, giving way to its other floors, kept for the next ask. */
export function groundRing(shown: ShownWays, way: WayOut, level: number): Vec[] {
  const byLevel = rings.get(way) ?? new Map<number, Vec[]>();
  rings.set(way, byLevel);
  let ring = byLevel.get(level);
  if (!ring) {
    ring = wayRing(way, level, groundDistance(shown));
    byLevel.set(level, ring);
  }
  return ring;
}

/** The distance to the floors of `shown` as `wayStrength` reads it. */
export function groundDistance(shown: ShownWays): (p: Vec) => number {
  return (p) => shown.field.distance(p.x, p.y);
}
