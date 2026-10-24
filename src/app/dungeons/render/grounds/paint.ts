import type { Bounds, Vec } from '../geometry';
import type { Hand, Material } from '../art/hand';
import type { PathFn } from '../art/paths';
import { hash2 } from '../art/noise';

/**
 * What the grounds need of a painter beyond its hand: the living and loose surfaces a house's
 * dungeon never had. Stone & shadow paints them in their colours; Engraved cuts them in ink.
 */
export interface GroundsPaint {
  /** Mown grass over `path`, within `bounds`: its colour and the blades the eye reads as lawn. */
  lawn(path: PathFn, bounds: Bounds): void;
  /** Raked gravel over `path`, within `bounds`. */
  gravel(path: PathFn, bounds: Bounds): void;
  /**
   * Dense leaves inside `rings`: clumps of about `clump` cells, lit on the side towards the light.
   * `dome` models a crown round as a whole (a tree's); without it the mass is a clipped hedge.
   */
  foliage(rings: readonly Vec[][], clump: number, salt: number, dome?: { centre: Vec; radius: number }): void;
  /** Still water in a basin `path`, deepening towards `centre`: its colour, and rings where the jet falls back. */
  pool(path: PathFn, centre: Vec, radius: number): void;
}

/** A part too small or too plain to show a grain (a finial, a ball's lit crown, paving the joints carry): the material's colour alone. */
export function flatSurface(hand: Hand, path: PathFn, material: Material): void {
  const { ctx } = hand.scene.env;
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = hand.paint(material).fill;
  ctx.fill();
  ctx.restore();
}

/** Points scattered over `bounds` about `per` to a cell, each jittered within its share, with a value 0..1 for the drawing to use. */
export function scatter(bounds: Bounds, per: number, seed: number): { x: number; y: number; t: number }[] {
  const step = 1 / Math.sqrt(per);
  const out: { x: number; y: number; t: number }[] = [];
  const i0 = Math.floor(bounds.minX / step);
  const j0 = Math.floor(bounds.minY / step);
  for (let j = j0; j * step < bounds.maxY; j++) {
    for (let i = i0; i * step < bounds.maxX; i++) {
      out.push({ x: (i + hash2(i, j, seed)) * step, y: (j + hash2(i, j, seed + 1)) * step, t: hash2(i, j, seed + 2) });
    }
  }
  return out;
}
