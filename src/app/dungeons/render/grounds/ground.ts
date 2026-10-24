/**
 * What lies flat on a house's grounds, drawn before light and shade: the lawn over the lot, the
 * gravel of paths and drive kerbed with a row of setts, the porch's paved platform with its steps,
 * and the paving inside each outbuilding. Then the shade the house, walls, hedges and trees cast
 * on the open ground.
 */

import type { GroundsPiece } from '../../model';
import { castShadow, type Hand } from '../art/hand';
import { polysPath, rectPoly } from '../art/paths';
import { grownRings, unionRings } from '../clipShapes';
import { pointsBounds, signedArea2, type Vec } from '../geometry';
import { OUTBUILDING_WALL, boxOf, outbuildingDoor, piecesOf, type GroundsLayout } from './groundsShapes';
import { flatSurface, type GroundsPaint } from './paint';
import { crownOf } from './garden';

/** A kerb of setts along the ways: its width and the length of a sett, in cells. */
const KERB = { width: 0.07, sett: 0.14 };

export function drawGroundsGround(hand: Hand, paint: GroundsPaint, layout: GroundsLayout): void {
  const lotBounds = pointsBounds(layout.lot);
  paint.lawn(polysPath(layout.open), lotBounds);
  drawWays(hand, paint, layout.ways);
  for (const porch of piecesOf(layout, 'porch')) drawPorchFloor(hand, porch);
  for (const building of piecesOf(layout, 'outbuilding')) drawOutbuildingFloor(hand, building);
}

/** The gravel of the paths and drive, kerbed along every edge. */
export function drawWays(hand: Hand, paint: GroundsPaint, rings: readonly Vec[][]): void {
  const ways = unionRings(rings);
  if (!ways.length) return;
  paint.gravel(polysPath(ways), pointsBounds(ways.flat()));
  kerb(hand, ways);
}

/** A row of setts along the inside of every edge of the ways. */
function kerb(hand: Hand, rings: readonly Vec[][]): void {
  const inner = grownRings(rings, -KERB.width, 'miter');
  const largest = rings.reduce((best, ring) => (Math.abs(signedArea2(ring)) > Math.abs(signedArea2(best)) ? ring : best));
  // Every ring keeps the ways on the same side of its way round, so one turn serves them all.
  const turn = Math.sign(signedArea2(largest));
  const joints: Vec[][] = [];
  for (const ring of rings) {
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-6) return;
      const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      const n = { x: t.y * turn, y: -t.x * turn };
      for (let s = KERB.sett / 2; s < len - KERB.sett / 3; s += KERB.sett) {
        const p = { x: a.x + t.x * s, y: a.y + t.y * s };
        joints.push([p, { x: p.x - n.x * KERB.width, y: p.y - n.y * KERB.width }]);
      }
    });
  }
  hand.line(joints, 'fine');
  hand.line([...rings, ...inner], 'fine', true);
}

/** Which way a porch faces: away from the door, towards its columns. */
function porchFrame(porch: GroundsPiece): { box: { x: number; y: number; w: number; h: number }; out: Vec } {
  const box = boxOf(porch.cells);
  const col = porch.columns?.[0];
  const out = col && col.y < box.y + box.h / 2 ? { x: 0, y: -1 } : { x: 0, y: 1 };
  return { box, out };
}

/** The porch's platform of stone slabs, two steps down at its front. */
export function drawPorchFloor(hand: Hand, porch: GroundsPiece): void {
  const { box, out } = porchFrame(porch);
  const front = out.y > 0 ? box.y + box.h : box.y;
  const at = (depth: number): number => front - out.y * depth;
  const platform = rectPoly({ x: box.x + 0.04, y: Math.min(at(1), at(0.22)), w: box.w - 0.08, h: 0.78 });
  const steps = [0.22, 0.11].map((d, k) => rectPoly({ x: box.x - 0.02 * k, y: Math.min(at(d), at(d - 0.11)), w: box.w + 0.04 * k, h: 0.11 }));
  for (const step of steps.reverse()) {
    hand.surface(polysPath([step]), 'stone');
    hand.edges(step, true);
  }
  hand.surface(polysPath([platform]), 'raised');
  const slabs: Vec[][] = [];
  for (let x = box.x + 0.5; x < box.x + box.w - 0.1; x += 0.5) slabs.push([{ x, y: platform[0]!.y }, { x, y: platform[2]!.y }]);
  slabs.push([{ x: box.x + 0.04, y: at(0.6) }, { x: box.x + box.w - 0.04, y: at(0.6) }]);
  hand.line(slabs, 'fine');
  hand.edges(platform, true);
}

/** An outbuilding's paving: setts in a carriage house or stable, flags in a crypt, a brick walk between beds in a greenhouse. */
export function drawOutbuildingFloor(hand: Hand, building: GroundsPiece): void {
  const glass = building.use === 'greenhouse';
  const wall = glass ? OUTBUILDING_WALL.greenhouse : OUTBUILDING_WALL.solid;
  const box = boxOf(building.cells);
  const inside = { x: box.x + wall, y: box.y + wall, w: box.w - wall * 2, h: box.h - wall * 2 };
  const door = outbuildingDoor(building, wall);
  const floor = unionRings([rectPoly(inside), ...(door ? [door.gap] : [])]);
  // Plain paving: its joints carry it.
  flatSurface(hand, polysPath(floor), building.use === 'crypt' ? 'dressed' : 'stone');
  const [unit, course] = building.use === 'crypt' ? [0.6, 0.6] : glass ? [0.2, 0.1] : [0.24, 0.15];
  const lines: Vec[][] = [];
  for (let y = inside.y + course, row = 0; y < inside.y + inside.h - 0.02; y += course, row++) {
    lines.push([{ x: inside.x, y }, { x: inside.x + inside.w, y }]);
    for (let x = inside.x + (row % 2 ? unit / 2 : unit); x < inside.x + inside.w - 0.02; x += unit) lines.push([{ x, y: y - course }, { x, y }]);
  }
  hand.line(lines, 'fine');
  if (glass) {
    // Beds of earth either side of the walk, edged in brick.
    const long = inside.w >= inside.h;
    const beds = [-1, 1].map((side) => {
      const bed = long ? { x: inside.x + 0.1, y: side < 0 ? inside.y + 0.08 : inside.y + inside.h - 0.08 - inside.h * 0.32, w: inside.w - 0.2, h: inside.h * 0.32 } : { x: side < 0 ? inside.x + 0.08 : inside.x + inside.w - 0.08 - inside.w * 0.32, y: inside.y + 0.1, w: inside.w * 0.32, h: inside.h - 0.2 };
      return rectPoly(bed);
    });
    for (const bed of beds) {
      // Bare earth, darker than the walk, raked into furrows along the bed.
      const b = pointsBounds(bed);
      hand.surface(polysPath([bed]), 'floor');
      hand.tone(() => 0.4, b, polysPath([bed]), 'shade');
      const furrows: Vec[][] = [];
      for (let k = 1; k < 4; k++) furrows.push(long ? [{ x: b.minX + 0.06, y: b.minY + ((b.maxY - b.minY) * k) / 4 }, { x: b.maxX - 0.06, y: b.minY + ((b.maxY - b.minY) * k) / 4 }] : [{ x: b.minX + ((b.maxX - b.minX) * k) / 4, y: b.minY + 0.06 }, { x: b.minX + ((b.maxX - b.minX) * k) / 4, y: b.maxY - 0.06 }]);
      hand.line(furrows, 'fine');
      hand.edges(bed, true);
    }
  }
}

/** The shade on the open ground: the scene's shadows and occlusion, and each tree's soft shadow. */
export function drawGroundsShade(hand: Hand, layout: GroundsLayout): void {
  const { scene } = hand;
  const { env } = scene;
  if (!env.view.shadow) return;
  const strength = env.style.shadow.strength;
  // Engraved cuts the shade in lines that would bury the lawn's tufts: a lighter hand there.
  const scale = env.style.direction === 'engraved' ? 0.45 : 1.6;
  const clip = polysPath(layout.open);
  hand.tone((x, y) => Math.min(0.85, (0.5 * scene.occlusionAt(x, y) ** 1.25 + 0.55 * scene.shadowAt(x, y)) * strength * scale), pointsBounds(layout.lot), clip, 'shade');
  for (const tree of piecesOf(layout, 'tree')) {
    const crown = crownOf(tree, env.dungeon.model.seed);
    if (crown) castShadow(hand, polysPath([crown.ring]), 0.85, pointsBounds(crown.ring), env.style.direction === 'engraved' ? 0.35 : 0.45, clip);
  }
}
