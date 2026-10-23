import type { DungeonDoor } from '../../model';
import { pointSegmentDistance, type Vec } from '../geometry';
import type { VisibleDungeon } from '../visibleDungeon';
import { rectPoly, smoothstep } from './paths';

/**
 * The ways out of a dungeon. An entrance is a clean opening at the dungeon's edge: its passage's
 * walls stop at the mouth, no wall closes it, and the rock parts in front of it, so the way leads
 * on into the open ground.
 */
export interface Mouth {
  door: DungeonDoor;
  /** The middle of the mouth, on the cell's outer edge. */
  at: Vec;
  /** Outwards, away from the dungeon. */
  out: Vec;
}

/** How far the wall's course, its ink and the rock are cleared beyond a mouth, in cells. */
export const MOUTH_CLEAR = 0.7;
/** How far out the rock stays parted in front of a mouth. */
const PARTED = 2.6;

export function mouthsOf(dungeon: VisibleDungeon): Mouth[] {
  return dungeon.doors
    .filter(door => door.from === null && door.kind !== 'secret')
    .map(door => ({ door, out: { x: -door.dir.x, y: -door.dir.y }, at: { x: door.x + 0.5 - door.dir.x * 0.5, y: door.y + 0.5 - door.dir.y * 0.5 } }));
}

/** The ground just beyond a mouth, as wide as its passage: no wall course or wall ink lies there. */
export function mouthClearing(mouth: Mouth): Vec[] {
  const { at, out } = mouth;
  const across = { x: -out.y * 0.5, y: out.x * 0.5 };
  const corners = [-1, 1].flatMap(side => [0, MOUTH_CLEAR].map(o => ({ x: at.x + across.x * side + out.x * o, y: at.y + across.y * side + out.y * o })));
  const xs = corners.map(p => p.x);
  const ys = corners.map(p => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return rectPoly({ x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 });
}

/** 1 where the rock stands, 0 where it parts before a mouth: a passage widening as it leads away. */
export function partedRock(mouths: readonly Mouth[]): (x: number, y: number) => number {
  const ends = mouths.map(m => ({ a: m.at, b: { x: m.at.x + m.out.x * PARTED, y: m.at.y + m.out.y * PARTED } }));
  return (x, y) => {
    let keep = 1;
    for (const { a, b } of ends) {
      const d = pointSegmentDistance({ x, y }, a, b);
      const along = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / (PARTED * PARTED)));
      const half = 0.5 + along * 0.9;
      keep = Math.min(keep, smoothstep(half, half + 0.35, d));
    }
    return keep;
  };
}
