/**
 * What stands free on the lawn: trees, seen from above as a lobed crown of leaves over the point of
 * their trunk; the fountain the drive turns round, an octagonal basin of water on its island of
 * grass with a pedestal bowl in its middle; and the porch's two columns, each a square plinth under
 * its capital.
 */

import type { GroundsPiece } from '../../model';
import type { Hand } from '../art/hand';
import { hash2 } from '../art/noise';
import { polyPath, rectPoly } from '../art/paths';
import type { Vec } from '../geometry';
import { circlePoly } from './groundsShapes';
import type { GroundsPaint } from './paint';

/** A tree's crown: its lobed outline round the trunk, and the radius it reaches. */
export function crownOf(tree: GroundsPiece, seed: number): { ring: Vec[]; centre: Vec; radius: number } | null {
  const centre = tree.at;
  if (!centre) return null;
  const radius = tree.radius ?? 1;
  const lobes = 7 + Math.floor(hash2(Math.floor(centre.x), Math.floor(centre.y), seed + 21) * 4);
  const phase = hash2(Math.floor(centre.x), Math.floor(centre.y), seed + 22) * Math.PI * 2;
  const n = 72;
  const ring = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    // Rounded lobes, each a little different, the gaps between them shallow.
    const lobe = Math.abs(Math.sin((a * lobes) / 2 + phase));
    const jitter = hash2(k % n, Math.floor(centre.x * 7 + centre.y * 13), seed + 23) * 0.04;
    const r = radius * (0.86 + 0.12 * lobe ** 0.5 - jitter);
    return { x: centre.x + Math.cos(a) * r, y: centre.y + Math.sin(a) * r };
  });
  return { ring, centre, radius };
}

export function drawTree(hand: Hand, paint: GroundsPaint, tree: GroundsPiece): void {
  const crown = crownOf(tree, hand.scene.env.dungeon.model.seed);
  if (!crown) return;
  const { centre, radius } = crown;
  paint.foliage([crown.ring], 0.15, Math.floor(centre.x * 31 + centre.y * 17), { centre, radius });
  // The trunk's point, where it rises under the crown: a ring of bark round its heart.
  const trunk = circlePoly(centre, 0.06, 16);
  hand.surface(polyPath(trunk), 'wood');
  hand.line([trunk], 'fine', true);
}

/** The fountain a drive turns round: on its island of grass, a basin of eight sides and a bowl on a pedestal in its middle. */
export function drawFountain(hand: Hand, fountain: GroundsPiece): void {
  const c = fountain.at;
  if (!c) return;
  const octagon = (r: number): Vec[] => Array.from({ length: 8 }, (_, k) => ({ x: c.x + Math.cos(((k + 0.5) / 8) * Math.PI * 2) * r, y: c.y + Math.sin(((k + 0.5) / 8) * Math.PI * 2) * r }));
  const rim = octagon(0.9);
  const water = octagon(0.76);
  hand.surface(polyPath(rim), 'dressed');
  hand.line(rim.map((p, k) => [p, water[k]!]), 'fine');
  hand.water([water], (x, y) => Math.max(0, 0.76 - Math.hypot(x - c.x, y - c.y)) * 1.4, false);
  // Rings spreading from where the jet falls back.
  const ripples = [0.42, 0.58].map((r, k) => circlePoly(c, r, 40).slice(k * 4, 26 + k * 4));
  hand.line(ripples, 'fine');
  hand.edges(water, false);
  hand.edges(rim, true);
  const pedestal = circlePoly(c, 0.3, 32);
  const bowl = circlePoly(c, 0.22, 32);
  hand.surface(polyPath(pedestal), 'dressed');
  hand.solid(polyPath(pedestal), c, 0.3, 0.8);
  hand.edges(pedestal, true);
  hand.water([bowl], (x, y) => Math.max(0, 0.22 - Math.hypot(x - c.x, y - c.y)) * 1.6, false);
  hand.edges(bowl, false);
  const jet = circlePoly(c, 0.045, 12);
  hand.surface(polyPath(jet), 'metal');
  hand.edges(jet, true);
}

/** A porch's column seen from above: its square plinth, and over it the capital, a square abacus round the round of the shaft. */
export function drawColumn(hand: Hand, at: Vec): void {
  const plinth = rectPoly({ x: at.x - 0.15, y: at.y - 0.15, w: 0.3, h: 0.3 });
  const abacus = rectPoly({ x: at.x - 0.115, y: at.y - 0.115, w: 0.23, h: 0.23 });
  hand.surface(polyPath(plinth), 'dressed');
  hand.edges(plinth, true);
  hand.surface(polyPath(abacus), 'stone');
  hand.solid(polyPath(abacus), at, 0.12, 0.6);
  hand.edges(abacus, true);
  hand.line([circlePoly(at, 0.085, 24)], 'fine', true);
}
