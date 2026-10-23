import type { CellDir, DungeonDoor, DungeonStair } from '../../model';
import type { Vec } from '../geometry';
import { drawFlight } from '../terrain/raised';
import type { Hand } from './hand';
import { polyPath } from './paths';

/**
 * Passages and stairs, drawn once through a hand. An opening is the gap the walls leave (nothing
 * more); a door is a planked leaf hung between two dressed jambs; steps are treads across the
 * passage, darker towards the low end; a stairwell between floors goes down into the dark on the
 * floor above and comes up through a break line on the floor below, walled round on both. A secret
 * door is wall.
 */

/** Maps a point of a door cell's own frame (u across the way, v along it, −0.5..0.5) into cells. */
function cellFrame(door: Pick<DungeonDoor, 'x' | 'y' | 'dir'>): (u: number, v: number) => Vec {
  const { x, y, dir } = door;
  return (u, v) => ({ x: x + 0.5 + -dir.y * u + dir.x * v, y: y + 0.5 + dir.x * u + dir.y * v });
}

export function drawPassages(hand: Hand): void {
  for (const door of hand.scene.env.dungeon.doors) {
    if (door.kind === 'door') drawDoor(hand, door);
    else if (door.kind === 'steps') drawFlight(hand, { x: door.x, y: door.y, w: 1, h: 1 }, door.descends ? door.dir : flip(door.dir), 0, 0.22);
  }
  const index = hand.scene.env.dungeon.index;
  for (const stair of hand.scene.env.dungeon.floor.stairs) drawStairwell(hand, stair, stair.to > index ? 'upper' : 'lower');
}

const flip = (d: CellDir): CellDir => ({ x: -d.x as CellDir['x'], y: -d.y as CellDir['y'] });

/** A door: a leaf of planks bound with iron, hung between two dressed jambs set into the walls. */
function drawDoor(hand: Hand, door: DungeonDoor): void {
  const at = cellFrame(door);
  const quad = (u0: number, v0: number, u1: number, v1: number): Vec[] => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
  const jamb = 0.15;
  for (const side of [-1, 1]) {
    const q = side < 0 ? quad(-0.5, -0.15, -0.5 + jamb, 0.15) : quad(0.5 - jamb, -0.15, 0.5, 0.15);
    hand.surface(polyPath(q), 'dressed');
    hand.edges(q, true);
  }
  const half = 0.5 - jamb + 0.03;
  const leaf = quad(-half, -0.075, half, 0.075);
  hand.surface(polyPath(leaf), 'wood');
  hand.line([-0.18, 0, 0.18].map(u => [at(u, -0.075), at(u, 0.075)]), 'fine');
  for (const v of [-0.04, 0.04]) {
    const band = quad(-half, v - 0.012, half, v + 0.012);
    hand.surface(polyPath(band), 'metal');
  }
  hand.edges(leaf, true);
}

/**
 * A stairwell between floors, on the floor it goes down from (`upper`) or comes up to (`lower`):
 * the same treads on both, walled round. Going down, the treads sink into the dark at the low end;
 * coming up, past a break line where they pass through the ceiling, they fade.
 */
function drawStairwell(hand: Hand, stair: DungeonStair, end: 'upper' | 'lower'): void {
  const along = stair.down.x !== 0 ? stair.w : stair.h;
  const across = stair.down.x !== 0 ? stair.h : stair.w;
  const cx = stair.x + stair.w / 2;
  const cy = stair.y + stair.h / 2;
  // u across the treads, v along the way down.
  const at = (u: number, v: number): Vec => ({ x: cx + -stair.down.y * u + stair.down.x * v, y: cy + stair.down.x * u + stair.down.y * v });
  const top = -along / 2;
  const half = across / 2;
  drawFlight(hand, { x: stair.x, y: stair.y, w: stair.w, h: stair.h }, stair.down, 0.02, 0.2);
  const whole = [at(-half, top), at(half, top), at(half, -top), at(-half, -top)];
  if (end === 'upper') {
    // Deeper and deeper towards the low end, until the treads sink into the dark below.
    hand.tone((x, y) => {
      const v = (x - cx) * stair.down.x + (y - cy) * stair.down.y;
      const t = (v - top) / along;
      return Math.max(0, Math.min(1, (t - 0.35) / 0.65)) ** 1.6;
    }, { minX: stair.x, minY: stair.y, maxX: stair.x + stair.w, maxY: stair.y + stair.h }, polyPath(whole), 'depth');
  } else {
    const cut = top + along * 0.4;
    const faded = [at(-half, top), at(half, top), at(half, cut), at(-half, cut)];
    hand.tone(() => 0.35, { minX: stair.x, minY: stair.y, maxX: stair.x + stair.w, maxY: stair.y + stair.h }, polyPath(faded), 'shade');
    const kink = 0.06;
    hand.line([[at(-half, cut + kink), at(-kink, cut + kink), at(0, cut - kink), at(kink, cut + kink * 1.6), at(kink * 2, cut - kink * 0.5), at(half, cut - kink * 0.5)]], 'heavy');
  }
  // The well is walled round on both floors, so the stairs read as one shaft.
  hand.line([whole], 'heavy', true);
}
