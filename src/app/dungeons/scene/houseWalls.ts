/**
 * What a house's walls need beyond a dungeon's (`DungeonFloor.walls === 'edges'`): a secret door's
 * doorway, which the map draws as wall, as a short passage its door closes; the outer face of a
 * front door's doorway, where the way out stays open; and every window, where the outer wall is cut
 * and a wall that stops a token but neither sight nor light stands instead.
 */

import type { DungeonDoor, DungeonRoom, DungeonWindow } from '../model';
import type { RectShape, Vec } from '../render/geometry';
import { OUTER_WALL, doorwayShape, houseCells, windowSpan } from '../render/houseShapes';
import type { VisibleFloor } from '../render/visibleDungeon';
import { STEPS, type DoorLine, type RingHit } from './wallOutline';

const EPS = 1e-9;

/** The doorways of a house's secret doors: passages through the wall, which their doors close. */
export function secretDoorways(visible: Pick<VisibleFloor, 'floor' | 'rooms' | 'doors'>): RectShape[] {
  if (visible.floor.walls !== 'edges') return [];
  const house = houseCells(visible.floor);
  const rooms = new Map<number, DungeonRoom>(visible.rooms.map((room) => [room.id, room]));
  return visible.doors.filter((door) => door.kind === 'secret').map((door) => doorwayShape(door, rooms, house));
}

/** The middle of the outer face of an entrance's doorway on an edge, grown by `half`: where no wall closes it. */
export function edgeMouth(door: DungeonDoor, mid: Vec, half: number): Vec {
  const out = OUTER_WALL / 2 + half;
  return { x: mid.x - door.dir.x * out, y: mid.y - door.dir.y * out };
}

/** Where a window's two ends cut the nearest wall ring: a line through each end, across the wall. */
export function windowCuts(rings: readonly Vec[][], window: DungeonWindow, reach: number): [RingHit, RingHit] | null {
  const ends = windowSpan(window).map((at) => nearestHit(rings, { at, across: { x: window.dir.x, y: window.dir.y } }, reach));
  const [a, b] = ends;
  return a && b ? [a, b] : null;
}

function nearestHit(rings: readonly Vec[][], line: DoorLine, reach: number): RingHit | null {
  let best: RingHit | null = null;
  rings.forEach((ring, r) => {
    for (let edge = 0; edge < ring.length; edge++) {
      const a = ring[edge]!;
      const b = ring[(edge + 1) % ring.length]!;
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const denom = line.across.x * ey - line.across.y * ex;
      if (Math.abs(denom) < EPS) continue;
      const dx = a.x - line.at.x;
      const dy = a.y - line.at.y;
      const t = (dx * ey - dy * ex) / denom;
      const along = (dx * line.across.y - dy * line.across.x) / denom;
      if (along < -EPS || along > 1 + EPS || Math.abs(t) > reach) continue;
      if (best && Math.abs(best.t) <= Math.abs(t)) continue;
      const point = { x: Math.round((line.at.x + line.across.x * t) * STEPS) / STEPS, y: Math.round((line.at.y + line.across.y * t) * STEPS) / STEPS };
      best = { ring: r, edge, along: Math.min(1, Math.max(0, along)), t, point };
    }
  });
  return best;
}

/** Whether a ring's edge from `a` to `b` lies between a window's two cuts: the glass, not the wall. */
export function onWindow(cuts: readonly [RingHit, RingHit][]): (a: Vec, b: Vec) => boolean {
  return (a, b) =>
    cuts.some(([p, q]) => {
      const lo = { x: Math.min(p.point.x, q.point.x) - EPS, y: Math.min(p.point.y, q.point.y) - EPS };
      const hi = { x: Math.max(p.point.x, q.point.x) + EPS, y: Math.max(p.point.y, q.point.y) + EPS };
      const inside = (v: Vec): boolean => v.x >= lo.x && v.x <= hi.x && v.y >= lo.y && v.y <= hi.y;
      return inside(a) && inside(b);
    });
}
