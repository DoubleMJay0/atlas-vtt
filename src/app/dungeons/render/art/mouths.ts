import { doorCells } from '../../geometry';
import type { DungeonDoor } from '../../model';
import type { Vec } from '../geometry';
import type { VisibleDungeon } from '../visibleDungeon';
import { rectPoly } from './paths';

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
  /** Across, in cells: two for a cave's wide narrows. */
  width: number;
}

/** How far the wall's course, its ink and the rock are cleared beyond a mouth, in cells. */
export const MOUTH_CLEAR = 0.7;

export function mouthsOf(dungeon: VisibleDungeon): Mouth[] {
  return dungeon.doors
    .filter(door => door.from === null && door.kind !== 'secret')
    .map(door => {
      const cells = doorCells(door);
      const cx = cells.reduce((sum, c) => sum + c.x + 0.5, 0) / cells.length;
      const cy = cells.reduce((sum, c) => sum + c.y + 0.5, 0) / cells.length;
      return { door, out: { x: -door.dir.x, y: -door.dir.y }, at: { x: cx - door.dir.x * 0.5, y: cy - door.dir.y * 0.5 }, width: cells.length };
    });
}

/** The ground just beyond a mouth, as wide as its passage: no wall course or wall ink lies there. */
export function mouthClearing(mouth: Mouth): Vec[] {
  const { at, out } = mouth;
  const across = { x: -out.y * 0.5 * mouth.width, y: out.x * 0.5 * mouth.width };
  const corners = [-1, 1].flatMap(side => [0, MOUTH_CLEAR].map(o => ({ x: at.x + across.x * side + out.x * o, y: at.y + across.y * side + out.y * o })));
  const xs = corners.map(p => p.x);
  const ys = corners.map(p => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return rectPoly({ x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 });
}
