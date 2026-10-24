/**
 * What closes a house's grounds and divides them: the boundary wall, coursed masonry under a
 * saddleback coping whose ridge runs along its middle; clipped hedges, a dense box of leaves with
 * its flat top; and gates between square piers with ball finials, of iron at the front (a top rail
 * and the spear heads of its bars, two leaves meeting in the middle) and of timber at the service
 * gate. Each is drawn on its whole cells, so the scene's walls on their edges lie on its ink.
 */

import type { GroundsPiece } from '../../model';
import type { Hand } from '../art/hand';
import { TO_LIGHT } from '../art/light';
import { polyPath, polysPath } from '../art/paths';
import { grownRings } from '../clipShapes';
import { cellsShapes, signedArea2, type Vec } from '../geometry';
import { boxOf, cellSet, circlePoly } from './groundsShapes';
import { flatSurface, type GroundsPaint } from './paint';

/** The coping's inset from the wall's faces, in cells. */
const COPING = 0.2;
/** A gate pier's length along the wall, in cells. */
const PIER = 0.62;
/** A coping stone's length, and how far apart the joints of the courses below it lie. */
const COPING_STONE = 0.5;
const COURSE = 0.3;

function ringsOf(piece: GroundsPiece): Vec[][] {
  return cellsShapes(piece.cells).flatMap((shape) => shape.rings);
}

/** A ring's edges as standing up: a hole's from the other side, since the wall stands round it. */
function standingEdges(hand: Hand, rings: readonly Vec[][]): void {
  for (const ring of rings) hand.edges(ring, signedArea2(ring) > 0);
}

export function drawBoundaryWall(hand: Hand, wall: GroundsPiece): void {
  const rings = ringsOf(wall);
  hand.surface(polysPath(rings), 'dressed');
  const coping = grownRings(rings, -COPING, 'miter');
  const has = cellSet(wall.cells);
  const ridge: Vec[][] = [];
  const joints: Vec[][] = [];
  for (const c of wall.cells) {
    const mid = { x: c.x + 0.5, y: c.y + 0.5 };
    const across = has(c.x - 1, c.y) || has(c.x + 1, c.y);
    const down = has(c.x, c.y - 1) || has(c.x, c.y + 1);
    if (has(c.x + 1, c.y)) ridge.push([mid, { x: mid.x + 1, y: mid.y }]);
    if (has(c.x, c.y + 1)) ridge.push([mid, { x: mid.x, y: mid.y + 1 }]);
    if (across === down) continue;
    // Joints across the faces below the coping, staggered between the two faces.
    for (const [face, shift] of [[COPING / 2, 0], [1 - COPING / 2, COURSE / 2]] as const) {
      for (let s = 0.1 + shift; s < 1; s += COURSE) joints.push(across ? [{ x: c.x + s, y: c.y + face - COPING / 2 }, { x: c.x + s, y: c.y + face + COPING / 2 }] : [{ x: c.x + face - COPING / 2, y: c.y + s }, { x: c.x + face + COPING / 2, y: c.y + s }]);
    }
  }
  hand.line(joints, 'fine');
  hand.surface(polysPath(coping), 'stone');
  const copingJoints = wall.cells.flatMap((c) => {
    const across = has(c.x - 1, c.y) || has(c.x + 1, c.y);
    const down = has(c.x, c.y - 1) || has(c.x, c.y + 1);
    if (across === down) return [];
    return [0, COPING_STONE].map((s): Vec[] => (across ? [{ x: c.x + 0.25 + s, y: c.y + COPING }, { x: c.x + 0.25 + s, y: c.y + 1 - COPING }] : [{ x: c.x + COPING, y: c.y + 0.25 + s }, { x: c.x + 1 - COPING, y: c.y + 0.25 + s }]));
  });
  hand.line([...ridge, ...copingJoints], 'fine');
  standingEdges(hand, coping);
  standingEdges(hand, rings);
}

export function drawHedge(hand: Hand, paint: GroundsPaint, hedge: GroundsPiece): void {
  const rings = ringsOf(hedge);
  const first = hedge.cells[0]!;
  paint.foliage(rings, 0.1, first.x * 13 + first.y * 7);
  // The flat top a hedge is clipped to, its sides falling away below it.
  hand.line(grownRings(rings, -0.11, 'round'), 'fine', true);
  standingEdges(hand, rings);
}

/** A gate across its cells' middle between two piers: iron leaves where it is the way in for guests, a timber leaf at the service gate. */
export function drawGate(hand: Hand, gate: GroundsPiece): void {
  const dir = gate.dir;
  if (!dir) return;
  const box = boxOf(gate.cells);
  const along = dir.y !== 0;
  const [u0, u1] = along ? [box.x, box.x + box.w] : [box.y, box.y + box.h];
  const v = along ? box.y + box.h / 2 : box.x + box.w / 2;
  const at = (u: number, dv: number): Vec => (along ? { x: u, y: v + dv } : { x: v + dv, y: u });
  const quad = (a: number, b: number, half: number): Vec[] => [at(a, -half), at(b, -half), at(b, half), at(a, half)];
  // The piers are the wall's ends, as wide as the wall, their faces the gateway's sides.
  const lines = drawPiers(hand, [quad(u0 - PIER, u0, 0.5), quad(u1, u1 + PIER, 0.5)]);
  if (u1 - u0 >= 2) lines.push(...ironLeaves(hand, u0, u1, at, quad));
  else timberLeaf(hand, u0, u1, at, quad);
  hand.line(lines, 'fine', true);
}

/** Two iron leaves meeting in the middle: each a top rail with the spear heads of its bars, a drop bolt where they meet; their outlines for the caller to draw. */
function ironLeaves(hand: Hand, a: number, b: number, at: (u: number, dv: number) => Vec, quad: (a: number, b: number, half: number) => Vec[]): Vec[][] {
  const mid = (a + b) / 2;
  const rails = [quad(a, mid - 0.015, 0.04), quad(mid + 0.015, b, 0.04)];
  const bars = Math.max(2, Math.round((mid - a) / 0.13));
  const heads = [a, mid + 0.015].flatMap((from) => Array.from({ length: bars + 1 }, (_, k) => circlePoly(at(from + ((mid - 0.015 - a) * k) / bars, 0), k === 0 || k === bars ? 0.045 : 0.03, 8)));
  const bolt = quad(mid - 0.035, mid + 0.035, 0.065);
  hand.surface(polysPath([...rails, bolt]), 'metal');
  flatSurface(hand, polysPath(heads), 'metal');
  return [...rails, bolt, ...heads];
}

function timberLeaf(hand: Hand, a: number, b: number, at: (u: number, dv: number) => Vec, quad: (a: number, b: number, half: number) => Vec[]): void {
  const leaf = quad(a, b, 0.06);
  hand.surface(polyPath(leaf), 'wood');
  const planks: Vec[][] = [];
  for (let u = a + 0.12; u < b - 0.05; u += 0.12) planks.push([at(u, -0.06), at(u, 0.06)]);
  hand.line(planks, 'fine');
  hand.edges(leaf, true);
}

/** Gate piers: blocks of dressed stone, their caps bevelled, a ball on each lit on its crown; their fine lines for the caller to draw. */
function drawPiers(hand: Hand, piers: readonly Vec[][]): Vec[][] {
  const centres = piers.map((pier) => ({ x: (pier[0]!.x + pier[2]!.x) / 2, y: (pier[0]!.y + pier[2]!.y) / 2 }));
  const caps = piers.map((pier, k) => pier.map((p) => ({ x: p.x + Math.sign(centres[k]!.x - p.x) * 0.07, y: p.y + Math.sign(centres[k]!.y - p.y) * 0.07 })));
  hand.surface(polysPath(piers), 'dressed');
  for (const pier of piers) hand.edges(pier, true);
  const balls = centres.map((c) => circlePoly(c, 0.17, 24));
  const lit = centres.map((c) => circlePoly({ x: c.x + TO_LIGHT.x * 0.06, y: c.y + TO_LIGHT.y * 0.06 }, 0.08, 16));
  flatSurface(hand, polysPath(balls), 'stone');
  flatSurface(hand, polysPath(lit), 'raised');
  return [...piers.flatMap((pier, k) => caps[k]!.map((p, i) => [pier[i]!, p])), ...caps, ...balls];
}
