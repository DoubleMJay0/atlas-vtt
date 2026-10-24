/**
 * An outbuilding as structure only, its inside empty: masonry walls round its cells with a door in
 * their gap, its roof's edge as the dashed line of the eaves beyond the walls; a greenhouse instead
 * stands on a low wall under glass, its ridge and hips and the bars of its glazing seen from above.
 * The family crypt is closed by an iron grille, every other building by a planked door.
 */

import type { GroundsPiece } from '../../model';
import type { Hand } from '../art/hand';
import { polyPath, polysPath, rectPoly } from '../art/paths';
import { signedArea2, type Vec } from '../geometry';
import { OUTBUILDING_WALL, boxOf, circlePoly, outbuildingDoor, outbuildingWalls } from './groundsShapes';

/** The eaves beyond the walls: how far out, and the dashes they are drawn in. */
const EAVES = { out: 0.11, dash: 0.14, gap: 0.09 };
/** Joints across a wall, this far apart. */
const BLOCK = 0.32;

export function drawOutbuilding(hand: Hand, building: GroundsPiece): void {
  const glass = building.use === 'greenhouse';
  const wall = glass ? OUTBUILDING_WALL.greenhouse : OUTBUILDING_WALL.solid;
  const box = boxOf(building.cells);
  const walls = outbuildingWalls(building);
  if (glass) glazing(hand, box, wall);
  hand.surface(polysPath(walls), 'dressed');
  if (!glass) {
    const { ctx } = hand.scene.env;
    ctx.save();
    ctx.beginPath();
    polysPath(walls)(ctx);
    ctx.clip();
    hand.line(blockJoints(box, wall), 'fine');
    ctx.restore();
  }
  for (const ring of walls) hand.edges(ring, signedArea2(ring) > 0);
  const door = outbuildingDoor(building, wall);
  if (door) drawDoor(hand, door, wall, building.use === 'crypt');
  if (!glass) hand.line(eaves(box), 'fine');
}

/** Joints across the wall all round, so it reads as laid stone; drawn inside the walls, so the doorway's gap stays clear. */
function blockJoints(box: { x: number; y: number; w: number; h: number }, wall: number): Vec[][] {
  const lines: Vec[][] = [];
  for (let x = box.x + BLOCK; x < box.x + box.w - 0.1; x += BLOCK) lines.push([{ x, y: box.y }, { x, y: box.y + wall }], [{ x: x + BLOCK / 2, y: box.y + box.h - wall }, { x: x + BLOCK / 2, y: box.y + box.h }]);
  for (let y = box.y + BLOCK; y < box.y + box.h - 0.1; y += BLOCK) lines.push([{ x: box.x, y: y + BLOCK / 2 }, { x: box.x + wall, y: y + BLOCK / 2 }], [{ x: box.x + box.w - wall, y }, { x: box.x + box.w, y }]);
  return lines;
}

/** The eaves: a dashed line round the walls, where the roof's edge lies above the ground. */
function eaves(box: { x: number; y: number; w: number; h: number }): Vec[][] {
  const ring = rectPoly({ x: box.x - EAVES.out, y: box.y - EAVES.out, w: box.w + EAVES.out * 2, h: box.h + EAVES.out * 2 });
  const dashes: Vec[][] = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % 4]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    for (let s = 0; s < len; s += EAVES.dash + EAVES.gap) {
      const e = Math.min(len, s + EAVES.dash);
      dashes.push([{ x: a.x + t.x * s, y: a.y + t.y * s }, { x: a.x + t.x * e, y: a.y + t.y * e }]);
    }
  });
  return dashes;
}

/** A greenhouse's roof of glass: panes over the inside, its ridge along the long side, hips to the corners and bars between the panes. */
function glazing(hand: Hand, box: { x: number; y: number; w: number; h: number }, wall: number): void {
  const inside = { x: box.x + wall, y: box.y + wall, w: box.w - wall * 2, h: box.h - wall * 2 };
  const pane = rectPoly(inside);
  const { ctx } = hand.scene.env;
  // Glass lets the beds below show through: Stone lays it thin, Engraved leaves the paper as it is.
  if (hand.scene.env.style.direction === 'stone') {
    ctx.save();
    ctx.globalAlpha = 0.5;
    hand.surface(polyPath(pane), 'glass');
    ctx.restore();
  }
  const long = inside.w >= inside.h;
  const half = (long ? inside.h : inside.w) / 2;
  const c = { x: inside.x + inside.w / 2, y: inside.y + inside.h / 2 };
  const ends = long ? [{ x: inside.x + half, y: c.y }, { x: inside.x + inside.w - half, y: c.y }] : [{ x: c.x, y: inside.y + half }, { x: c.x, y: inside.y + inside.h - half }];
  const bars: Vec[][] = [];
  const [a0, a1] = long ? [inside.x, inside.x + inside.w] : [inside.y, inside.y + inside.h];
  for (let u = a0 + 0.25; u < a1 - 0.1; u += 0.25) bars.push(long ? [{ x: u, y: inside.y }, { x: u, y: inside.y + inside.h }] : [{ x: inside.x, y: u }, { x: inside.x + inside.w, y: u }]);
  hand.line(bars, 'fine');
  const [p, q, r, s] = pane as [Vec, Vec, Vec, Vec];
  const [e0, e1] = ends as [Vec, Vec];
  hand.line([[e0, e1], [p, e0], [s, e0], [q, e1], [r, e1]], 'outline');
}

/** The door in an outbuilding's doorway: planks bound with iron, or a crypt's grille of bars. */
function drawDoor(hand: Hand, door: NonNullable<ReturnType<typeof outbuildingDoor>>, wall: number, grille: boolean): void {
  const { mid, inward } = door;
  const across = { x: -inward.y, y: inward.x };
  const centre = { x: mid.x + inward.x * wall / 2, y: mid.y + inward.y * wall / 2 };
  const at = (u: number, v: number): Vec => ({ x: centre.x + across.x * u + inward.x * v, y: centre.y + across.y * u + inward.y * v });
  const leaf = [at(-0.36, -0.045), at(0.36, -0.045), at(0.36, 0.045), at(-0.36, 0.045)];
  if (grille) {
    hand.surface(polyPath(leaf), 'metal');
    hand.edges(leaf, true);
    for (let k = 0; k <= 7; k++) {
      const head = circlePoly(at(-0.32 + (k * 0.64) / 7, 0), 0.022, 10);
      hand.surface(polyPath(head), 'metal');
      hand.line([head], 'fine', true);
    }
    return;
  }
  hand.surface(polyPath(leaf), 'wood');
  hand.line([-0.18, 0, 0.18].map((u) => [at(u, -0.045), at(u, 0.045)]), 'fine');
  hand.edges(leaf, true);
}
